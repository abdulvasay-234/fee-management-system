import { describe, expect, it, vi } from 'vitest'
import { AppsScriptClient } from '../src/appsScript.js'

const identity = {
  email: 'approved@gmail.com',
  googleSub: 'subject-1',
  name: 'Approved User',
}

describe('Apps Script server-to-server proxy', () => {
  it('sends GET semantics as a protected POST envelope', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(init?.method).toBe('POST')
      expect(init?.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
      expect(body).toEqual({
        action: 'students',
        gatewayIdentity: identity,
        gatewaySecret: 'server-only-secret',
        search: 'test',
      })
      return new Response(JSON.stringify({ success: true, data: [] }), { status: 200 })
    })
    const client = new AppsScriptClient(
      'https://script.google.com/macros/s/test/exec',
      'server-only-secret',
      fetchMock as typeof fetch,
    )

    const result = await client.forward(
      { action: 'students', method: 'GET', parameters: { search: 'test' } },
      identity,
    )
    expect(result).toEqual({ body: { success: true, data: [] }, status: 200 })
  })

  it('overrides follow-up createdBy with verified identity', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      expect(body.createdBy).toBe(identity.email)
      expect(body.createdBy).not.toBe('forged@gmail.com')
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    })
    const client = new AppsScriptClient('https://script.google.com/test', 'server-only-secret', fetchMock as typeof fetch)
    await client.forward(
      { action: 'add-followup', method: 'POST', parameters: { createdBy: 'forged@gmail.com' } },
      identity,
    )
  })

  it('does not return the gateway secret to the caller', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      gatewaySecret: 'never-return-this',
      message: 'echo never-return-this',
      stack: 'internal stack',
      success: true,
    }), { status: 200 }))
    const client = new AppsScriptClient('https://script.google.com/test', 'never-return-this', fetchMock as typeof fetch)
    const result = await client.forward({ action: 'dashboard', method: 'GET', parameters: {} }, identity)
    expect(JSON.stringify(result)).not.toContain('never-return-this')
    expect(JSON.stringify(result)).not.toContain('internal stack')
    expect(result.body).toEqual({ message: 'echo [REDACTED]', success: true })
  })
})
