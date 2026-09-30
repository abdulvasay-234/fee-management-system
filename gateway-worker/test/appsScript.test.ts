import { describe, expect, it, vi } from 'vitest'
import { forwardToAppsScript } from '../src/appsScript'
import type { AuthenticatedIdentity, FetchImplementation, GatewayConfig } from '../src/types'

const config: GatewayConfig = {
  allowedEmails: new Set(['approved@gmail.com']),
  allowedOrigins: new Set(['https://example.github.io']),
  appsScriptGatewaySecret: 'server-only-secret-value-123456',
  appsScriptUrl: 'https://script.google.com/macros/s/test/exec',
  googleClientId: 'client.apps.googleusercontent.com',
}

const identity: AuthenticatedIdentity = {
  email: 'approved@gmail.com',
  googleSub: 'google-subject-1',
  name: 'Approved User',
}

describe('Apps Script server-to-server proxy', () => {
  it('sends the exact nested protected envelope', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(config.appsScriptUrl)
      expect(init?.method).toBe('POST')
      expect(init?.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
      expect(JSON.parse(String(init?.body))).toEqual({
        action: 'students',
        parameters: { search: 'Jane' },
        gatewaySecret: config.appsScriptGatewaySecret,
        gatewayIdentity: identity,
      })
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
    })
    const result = await forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: { search: 'Jane' } },
      identity,
      config,
      fetchMock as FetchImplementation,
    )
    expect(result).toEqual({ body: { success: true, data: [] }, status: 200 })
  })

  it('overwrites browser identity and createdBy with verified identity', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const envelope = JSON.parse(String(init?.body))
      expect(envelope.gatewayIdentity).toEqual(identity)
      expect(envelope.parameters).toEqual({ createdBy: identity.email, notes: 'safe' })
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    await forwardToAppsScript(
      {
        action: 'add-followup',
        method: 'POST',
        parameters: {
          createdBy: 'fake@gmail.com',
          gatewayIdentity: { email: 'fake@gmail.com' },
          gatewaySecret: 'fake-secret',
          notes: 'safe',
        },
      },
      identity,
      config,
      fetchMock as FetchImplementation,
    )
  })

  it('redacts secrets and internal response fields', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      appsScriptUrl: config.appsScriptUrl,
      gatewaySecret: config.appsScriptGatewaySecret,
      message: `echo ${config.appsScriptGatewaySecret}`,
      stack: 'internal stack',
      success: true,
    }), { status: 200 }))
    const result = await forwardToAppsScript(
      { action: 'dashboard', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(config.appsScriptGatewaySecret)
    expect(serialized).not.toContain('internal stack')
    expect(serialized).not.toContain(config.appsScriptUrl)
  })

  it('rejects network failures without retrying mutations', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network unavailable') })
    await expect(forwardToAppsScript(
      { action: 'add-payment', method: 'POST', parameters: { amountPaid: 100 } },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).rejects.toThrow('network unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects upstream HTTP errors', async () => {
    const fetchMock = vi.fn(async () => new Response('failure', { status: 500 }))
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).rejects.toThrow('Apps Script returned HTTP 500')
  })

  it('follows only the trusted Apps Script 302 redirect without forwarding the secret body', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (fetchMock.mock.calls.length === 1) {
        expect(init?.method).toBe('POST')
        return new Response(null, {
          status: 302,
          headers: { Location: 'https://script.googleusercontent.com/macros/echo?key=test' },
        })
      }
      expect(String(url)).toContain('https://script.googleusercontent.com/macros/echo')
      expect(init?.method).toBe('GET')
      expect(init?.body).toBeUndefined()
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).resolves.toEqual({ body: { success: true }, status: 200 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects 307 redirects rather than forwarding the protected body', async () => {
    const fetchMock = vi.fn(async () => new Response(null, {
      status: 307,
      headers: { Location: 'https://attacker.example/collect' },
    }))
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).rejects.toThrow('unsafe redirect')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects oversized upstream responses', async () => {
    const fetchMock = vi.fn(async () => new Response('x'.repeat(5 * 1024 * 1024 + 1), { status: 200 }))
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).rejects.toThrow('size limit')
  })

  it('rejects non-JSON upstream responses', async () => {
    const fetchMock = vi.fn(async () => new Response('<html>failure</html>', { status: 200 }))
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
    )).rejects.toThrow('non-JSON')
  })

  it('aborts timed-out upstream requests without retrying', async () => {
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    await expect(forwardToAppsScript(
      { action: 'students', method: 'GET', parameters: {} },
      identity,
      config,
      fetchMock as FetchImplementation,
      1,
    )).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
