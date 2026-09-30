import type { AuthenticatedIdentity } from './auth.js'

const GET_ACTIONS = new Set([
  'course-codes',
  'students',
  'student',
  'payments',
  'dashboard',
  'walkins',
  'followups',
])

const POST_ACTIONS = new Set([
  'add-course',
  'update-course',
  'delete-course',
  'add-student',
  'add-payment',
  'add-walkin',
  'update-walkin',
  'mark-walkin-exit',
  'add-followup',
  'update-followup',
  'rebuild-indexes',
])

const SENSITIVE_RESPONSE_KEYS = new Set([
  'authorization',
  'credential',
  'gatewayidentity',
  'gatewaysecret',
  'idtoken',
  'stack',
  'stacktrace',
])

function redactSensitiveResponse(value: unknown, gatewaySecret: string): unknown {
  if (typeof value === 'string') return value.includes(gatewaySecret) ? value.replaceAll(gatewaySecret, '[REDACTED]') : value
  if (Array.isArray(value)) return value.map((item) => redactSensitiveResponse(item, gatewaySecret))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_RESPONSE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, redactSensitiveResponse(item, gatewaySecret)]),
  )
}

export interface ProxyRequest {
  action: string
  method: 'GET' | 'POST'
  parameters: Record<string, unknown>
}

export interface ProxyResponse {
  body: unknown
  status: number
}

export interface AppsScriptProxy {
  forward(request: ProxyRequest, identity: AuthenticatedIdentity): Promise<ProxyResponse>
}

export function isAllowedAction(method: 'GET' | 'POST', action: string) {
  return (method === 'GET' ? GET_ACTIONS : POST_ACTIONS).has(action)
}

export class AppsScriptClient implements AppsScriptProxy {
  constructor(
    private readonly url: string,
    private readonly gatewaySecret: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async forward(request: ProxyRequest, identity: AuthenticatedIdentity): Promise<ProxyResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const upstreamBody: Record<string, unknown> = {
      ...request.parameters,
      action: request.action,
      gatewaySecret: this.gatewaySecret,
      gatewayIdentity: {
        email: identity.email,
        googleSub: identity.googleSub,
        ...(identity.name ? { name: identity.name } : {}),
      },
    }
    if (request.action === 'add-followup') upstreamBody.createdBy = identity.email

    try {
      const upstream = await this.fetchImplementation(this.url, {
        body: JSON.stringify(upstreamBody),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        method: 'POST',
        redirect: 'follow',
        signal: controller.signal,
      })
      const text = await upstream.text()
      let body: unknown
      try {
        body = JSON.parse(text)
      } catch {
        throw new Error('Apps Script returned a non-JSON response')
      }
      if (!upstream.ok) throw new Error(`Apps Script returned HTTP ${upstream.status}`)
      return { body: redactSensitiveResponse(body, this.gatewaySecret), status: upstream.status }
    } finally {
      clearTimeout(timeout)
    }
  }
}
