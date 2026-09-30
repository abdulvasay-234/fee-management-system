import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/app.js'
import type { AppsScriptProxy, ProxyRequest, ProxyResponse } from '../src/appsScript.js'
import type { AuthenticatedIdentity, TokenVerifier, VerifiedGoogleClaims } from '../src/auth.js'
import type { GatewayConfig } from '../src/config.js'

const config: GatewayConfig = {
  allowedEmails: new Set(['approved@gmail.com']),
  allowedOrigin: 'https://example.github.io',
  appsScriptGatewaySecret: 'a'.repeat(32),
  appsScriptUrl: 'https://script.google.com/macros/s/test/exec',
  googleClientId: 'client.apps.googleusercontent.com',
  port: 8080,
}

const validClaims: VerifiedGoogleClaims = {
  aud: config.googleClientId,
  email: 'Approved@Gmail.com',
  email_verified: true,
  exp: Math.floor(Date.now() / 1000) + 3600,
  iss: 'https://accounts.google.com',
  name: 'Approved User',
  sub: 'google-subject-1',
}

class StubVerifier implements TokenVerifier {
  constructor(private readonly result: VerifiedGoogleClaims | Error) {}
  async verify() {
    if (this.result instanceof Error) throw this.result
    return this.result
  }
}

class StubProxy implements AppsScriptProxy {
  readonly forward = vi.fn(async (_request: ProxyRequest, _identity: AuthenticatedIdentity): Promise<ProxyResponse> => ({
    body: { success: true, data: [] },
    status: 200,
  }))
}

function appWith(claims: VerifiedGoogleClaims | Error = validClaims) {
  const proxy = new StubProxy()
  return { app: createApp(config, new StubVerifier(claims), proxy), proxy }
}

function authenticatedGet(app: ReturnType<typeof createApp>, path = '/api?action=students') {
  return request(app).get(path).set('Authorization', 'Bearer valid-token').set('Origin', config.allowedOrigin)
}

describe('gateway security', () => {
  it('exposes only a minimal public health response', async () => {
    const { app } = appWith()
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ ok: true })
  })

  it('rejects a missing token', async () => {
    const { app } = appWith()
    const response = await request(app).get('/api?action=students')
    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Authentication required' })
  })

  it('rejects malformed bearer authorization', async () => {
    const { app } = appWith()
    const response = await request(app).get('/api?action=students').set('Authorization', 'invalid')
    expect(response.status).toBe(401)
  })

  it('rejects a token that fails official verification', async () => {
    const { app } = appWith(new Error('invalid token'))
    const response = await authenticatedGet(app)
    expect(response.status).toBe(401)
    expect(response.text).not.toContain('invalid token')
  })

  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['wrong audience', { aud: 'wrong-client' }],
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['unverified email', { email_verified: false }],
  ])('rejects %s claims', async (_label, override) => {
    const { app } = appWith({ ...validClaims, ...override })
    expect((await authenticatedGet(app)).status).toBe(401)
  })

  it('rejects a valid but unapproved Google identity', async () => {
    const { app, proxy } = appWith({ ...validClaims, email: 'other@gmail.com' })
    const response = await authenticatedGet(app)
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Access denied' })
    expect(proxy.forward).not.toHaveBeenCalled()
  })

  it('forwards an approved identity and normalizes its email', async () => {
    const { app, proxy } = appWith()
    const response = await authenticatedGet(app)
    expect(response.status).toBe(200)
    expect(proxy.forward).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'students', method: 'GET' }),
      { email: 'approved@gmail.com', googleSub: 'google-subject-1', name: 'Approved User' },
    )
  })

  it('rejects an unapproved browser origin', async () => {
    const { app, proxy } = appWith()
    const response = await request(app)
      .get('/api?action=students')
      .set('Authorization', 'Bearer valid-token')
      .set('Origin', 'https://attacker.example')
    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Origin not allowed' })
    expect(proxy.forward).not.toHaveBeenCalled()
  })

  it('answers preflight only for the configured origin', async () => {
    const { app } = appWith()
    const response = await request(app).options('/api').set('Origin', config.allowedOrigin)
    expect(response.status).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe(config.allowedOrigin)
    expect(response.headers['access-control-allow-origin']).not.toBe('*')
  })

  it('does not allow unsupported or debug actions', async () => {
    const { app } = appWith()
    expect((await authenticatedGet(app, '/api?action=test-drive')).status).toBe(400)
  })

  it('requires POST for the state-changing rebuild action', async () => {
    const { app, proxy } = appWith()
    expect((await authenticatedGet(app, '/api?action=rebuild-indexes')).status).toBe(400)
    const response = await request(app)
      .post('/api')
      .set('Authorization', 'Bearer valid-token')
      .send({ action: 'rebuild-indexes', confirm: 'REBUILD_INDEXES' })
    expect(response.status).toBe(200)
    expect(proxy.forward).toHaveBeenCalledWith(
      { action: 'rebuild-indexes', method: 'POST', parameters: { confirm: 'REBUILD_INDEXES' } },
      expect.any(Object),
    )
  })

  it('returns 400 for malformed JSON instead of reporting an upstream failure', async () => {
    const { app, proxy } = appWith()
    const response = await request(app)
      .post('/api')
      .set('Authorization', 'Bearer valid-token')
      .set('Content-Type', 'text/plain')
      .send('{invalid')
    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'Invalid request body' })
    expect(proxy.forward).not.toHaveBeenCalled()
  })

  it('preserves the existing POST action contract and strips client gateway metadata', async () => {
    const { app, proxy } = appWith()
    const response = await request(app)
      .post('/api')
      .set('Authorization', 'Bearer valid-token')
      .set('Origin', config.allowedOrigin)
      .send({ action: 'add-payment', amountPaid: 100, gatewaySecret: 'client-value', gatewayIdentity: { email: 'fake' } })
    expect(response.status).toBe(200)
    expect(proxy.forward).toHaveBeenCalledWith(
      {
        action: 'add-payment',
        method: 'POST',
        parameters: { amountPaid: 100 },
      },
      expect.objectContaining({ email: 'approved@gmail.com' }),
    )
  })
})
