import { describe, expect, it, vi } from 'vitest'
import { GET_ACTIONS, POST_ACTIONS } from '../src/actions'
import { createGatewayHandler } from '../src/index'
import { loadConfig } from '../src/config'
import type { AuthenticatedIdentity, Env, GatewayConfig, ProxyRequest } from '../src/types'

const env: Env = {
  ALLOWED_EMAILS: 'approved@gmail.com',
  ALLOWED_ORIGIN: 'https://example.github.io,http://localhost:5173',
  APPS_SCRIPT_GATEWAY_SECRET: 's'.repeat(32),
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec',
  GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
}
const productionOrigin = 'https://example.github.io'

const approvedIdentity: AuthenticatedIdentity = {
  email: 'approved@gmail.com',
  googleSub: 'google-subject-1',
  name: 'Approved User',
}

function setup(identity: AuthenticatedIdentity | Error = approvedIdentity) {
  const verifyToken = vi.fn(async () => {
    if (identity instanceof Error) throw identity
    return identity
  })
  const forwardRequest = vi.fn(async () => ({ body: { success: true, data: [] }, status: 200 }))
  return { handle: createGatewayHandler({ verifyToken, forwardRequest }), verifyToken, forwardRequest }
}

function apiRequest(method: string, path: string, body?: unknown, authorization = 'Bearer valid-token', origin = productionOrigin) {
  return new Request(`https://worker.example${path}`, {
    method,
    headers: {
      ...(authorization ? { Authorization: authorization } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('Worker gateway routing and authorization', () => {
  it('provides a minimal public health endpoint', async () => {
    const { handle } = setup()
    const response = await handle(new Request('https://worker.example/health'), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('keeps health public while protected routes fail closed without configuration', async () => {
    const { handle } = setup()
    const missingConfig = {} as Env
    const health = await handle(new Request('https://worker.example/health'), missingConfig)
    const protectedResponse = await handle(new Request('https://worker.example/api?action=students'), missingConfig)
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ ok: true })
    expect(protectedResponse.status).toBe(503)
    expect(await protectedResponse.json()).toEqual({ error: 'Service unavailable' })
  })

  it('returns 401 with CORS for missing and malformed authorization', async () => {
    const { handle } = setup(new Error('invalid'))
    for (const authorization of ['', 'invalid', 'Bearer fake']) {
      const response = await handle(apiRequest('GET', '/api?action=students', undefined, authorization), env)
      expect(response.status).toBe(401)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(productionOrigin)
    }
  })

  it('returns 403 with CORS for a valid but unapproved identity', async () => {
    const { handle } = setup({ ...approvedIdentity, email: 'other@gmail.com' })
    const response = await handle(apiRequest('GET', '/api?action=students'), env)
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(productionOrigin)
  })

  it('rejects an unapproved origin before authentication', async () => {
    const { handle, verifyToken } = setup()
    const response = await handle(apiRequest('GET', '/api?action=students', undefined, 'Bearer valid', 'https://attacker.example'), env)
    expect(response.status).toBe(403)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    expect(verifyToken).not.toHaveBeenCalled()
  })

  it('answers allowed preflight with strict non-wildcard CORS', async () => {
    const { handle } = setup()
    const response = await handle(apiRequest('OPTIONS', '/api', undefined, ''), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(productionOrigin)
    expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*')
  })

  it('allows only the exact configured localhost origin', async () => {
    const { handle } = setup()
    const allowed = await handle(apiRequest('OPTIONS', '/api', undefined, '', 'http://localhost:5173'), env)
    const nearMatch = await handle(apiRequest('OPTIONS', '/api', undefined, '', 'http://localhost:51730'), env)
    expect(allowed.status).toBe(204)
    expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173')
    expect(nearMatch.status).toBe(403)
    expect(nearMatch.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('allows every GET action and preserves query strings', async () => {
    for (const action of GET_ACTIONS) {
      const { handle, forwardRequest } = setup()
      const response = await handle(apiRequest('GET', `/api?action=${action}&search=Jane&date=2026-09-30`), env)
      expect(response.status).toBe(200)
      expect(forwardRequest).toHaveBeenCalledWith(
        { action, method: 'GET', parameters: { search: 'Jane', date: '2026-09-30' } },
        approvedIdentity,
        expect.any(Object) as GatewayConfig,
      )
    }
  })

  it('allows every POST action and preserves JSON value types', async () => {
    for (const action of POST_ACTIONS) {
      const { handle, forwardRequest } = setup()
      const response = await handle(apiRequest('POST', '/api', { action, enabled: true, amount: 100, date: '2026-09-30' }), env)
      expect(response.status).toBe(200)
      expect(forwardRequest).toHaveBeenCalledWith(
        { action, method: 'POST', parameters: { enabled: true, amount: 100, date: '2026-09-30' } },
        approvedIdentity,
        expect.any(Object) as GatewayConfig,
      )
    }
  })

  it('forwards Enquiries actions through the authenticated business route', async () => {
    const cases = [
      { method: 'GET', action: 'enquiries', path: '/api?action=enquiries', body: undefined, parameters: {} },
      { method: 'POST', action: 'add-enquiry', path: '/api', body: { action: 'add-enquiry', fullName: 'Jane' }, parameters: { fullName: 'Jane' } },
      { method: 'POST', action: 'update-enquiry', path: '/api', body: { action: 'update-enquiry', enquiryId: 'ENQ-000001' }, parameters: { enquiryId: 'ENQ-000001' } },
      { method: 'POST', action: 'convert-enquiry', path: '/api', body: { action: 'convert-enquiry', enquiryId: 'ENQ-000001' }, parameters: { enquiryId: 'ENQ-000001' } },
    ]
    for (const { method, action, path, body, parameters } of cases) {
      const { handle, verifyToken, forwardRequest } = setup()
      const response = await handle(apiRequest(method, path, body), env)
      expect(response.status).toBe(200)
      expect(verifyToken).toHaveBeenCalledWith('valid-token', env.GOOGLE_CLIENT_ID)
      expect(forwardRequest).toHaveBeenCalledWith(
        { action, method, parameters },
        approvedIdentity,
        expect.any(Object),
      )
    }
  })

  it('rejects unauthenticated and unapproved Enquiries requests before forwarding', async () => {
    const cases = [
      apiRequest('GET', '/api?action=enquiries', undefined, ''),
      apiRequest('POST', '/api', { action: 'add-enquiry' }, ''),
      apiRequest('POST', '/api', { action: 'update-enquiry' }, ''),
      apiRequest('POST', '/api', { action: 'convert-enquiry' }, ''),
    ]
    for (const request of cases) {
      const { handle, forwardRequest } = setup()
      const response = await handle(request, env)
      expect(response.status).toBe(401)
      expect(forwardRequest).not.toHaveBeenCalled()
    }
    for (const [method, path, body] of [
      ['GET', '/api?action=enquiries', undefined],
      ['POST', '/api', { action: 'add-enquiry' }],
      ['POST', '/api', { action: 'update-enquiry' }],
      ['POST', '/api', { action: 'convert-enquiry' }],
    ] as const) {
      const { handle, forwardRequest } = setup({ ...approvedIdentity, email: 'other@gmail.com' })
      const response = await handle(apiRequest(method, path, body), env)
      expect(response.status).toBe(403)
      expect(forwardRequest).not.toHaveBeenCalled()
    }
  })

  it('rejects unsupported actions and GET rebuild', async () => {
    const { handle } = setup()
    expect((await handle(apiRequest('GET', '/api?action=debug'), env)).status).toBe(400)
    expect((await handle(apiRequest('GET', '/api?action=rebuild-indexes'), env)).status).toBe(400)
  })

  it('allows rebuild-indexes only through POST', async () => {
    const { handle, forwardRequest } = setup()
    const response = await handle(apiRequest('POST', '/api', { action: 'rebuild-indexes', confirm: 'REBUILD_INDEXES' }), env)
    expect(response.status).toBe(200)
    expect(forwardRequest).toHaveBeenCalledWith(
      { action: 'rebuild-indexes', method: 'POST', parameters: { confirm: 'REBUILD_INDEXES' } },
      approvedIdentity,
      expect.any(Object),
    )
  })

  it('removes all browser-controlled identity and audit fields', async () => {
    const { handle, forwardRequest } = setup()
    await handle(apiRequest('POST', '/api', {
      action: 'add-followup',
      createdBy: 'fake@gmail.com',
      gatewayIdentity: { email: 'fake@gmail.com' },
      gatewaySecret: 'browser-secret',
      googleSub: 'fake-subject',
      notes: 'safe field',
    }), env)
    expect(forwardRequest).toHaveBeenCalledWith(
      { action: 'add-followup', method: 'POST', parameters: { notes: 'safe field' } },
      approvedIdentity,
      expect.any(Object),
    )
  })

  it('removes browser-controlled identity fields from GET parameters', async () => {
    const { handle, forwardRequest } = setup()
    await handle(apiRequest('GET', '/api?action=students&createdBy=fake&googleSub=fake&search=Jane'), env)
    expect(forwardRequest).toHaveBeenCalledWith(
      { action: 'students', method: 'GET', parameters: { search: 'Jane' } },
      approvedIdentity,
      expect.any(Object),
    )
  })

  it('rejects oversized streamed request bodies', async () => {
    const { handle, forwardRequest } = setup()
    const response = await handle(apiRequest('POST', '/api', {
      action: 'add-student',
      notes: 'x'.repeat(101 * 1024),
    }), env)
    expect(response.status).toBe(413)
    expect(forwardRequest).not.toHaveBeenCalled()
  })

  it('requires HTTPS origins except explicit localhost development', () => {
    expect(() => loadConfig({ ...env, ALLOWED_ORIGIN: 'http://example.com' })).toThrow('must use HTTPS')
    expect([...loadConfig({ ...env, ALLOWED_ORIGIN: 'https://example.github.io,http://127.0.0.1:5173' }).allowedOrigins]).toEqual([
      'https://example.github.io',
      'http://127.0.0.1:5173',
    ])
  })

  it('maps proxy failures to a generic 502 without leaking details', async () => {
    const forwardRequest = vi.fn(async () => { throw new Error('secret upstream detail') })
    const handle = createGatewayHandler({ verifyToken: async () => approvedIdentity, forwardRequest })
    const response = await handle(apiRequest('GET', '/api?action=students'), env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Upstream service unavailable' })
  })
})
