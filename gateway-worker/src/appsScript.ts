import type { AuthenticatedIdentity, FetchImplementation, GatewayConfig, ProxyRequest, ProxyResponse } from './types'

const SENSITIVE_RESPONSE_KEYS = new Set([
  'appsscripturl',
  'authorization',
  'credential',
  'gatewayidentity',
  'gatewaysecret',
  'idtoken',
  'stack',
  'stacktrace',
])
const MAX_UPSTREAM_RESPONSE_BYTES = 5 * 1024 * 1024

function redactSensitiveResponse(value: unknown, gatewaySecret: string, appsScriptUrl: string): unknown {
  if (typeof value === 'string') return value
    .replaceAll(gatewaySecret, '[REDACTED]')
    .replaceAll(appsScriptUrl, '[REDACTED]')
  if (Array.isArray(value)) return value.map((item) => redactSensitiveResponse(item, gatewaySecret, appsScriptUrl))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_RESPONSE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, redactSensitiveResponse(item, gatewaySecret, appsScriptUrl)]),
  )
}

async function readLimitedResponseText(response: Response) {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_UPSTREAM_RESPONSE_BYTES) {
      await reader.cancel()
      throw new Error('Apps Script response exceeded the size limit')
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

export async function forwardToAppsScript(
  request: ProxyRequest,
  identity: AuthenticatedIdentity,
  config: GatewayConfig,
  fetchImplementation: FetchImplementation = fetch,
  timeoutMs = 30_000,
): Promise<ProxyResponse> {
  const parameters: Record<string, unknown> = { ...request.parameters }
  delete parameters.gatewayIdentity
  delete parameters.gatewaySecret
  if (request.action === 'add-followup') parameters.createdBy = identity.email

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let upstream = await fetchImplementation(config.appsScriptUrl, {
      body: JSON.stringify({
        action: request.action,
        parameters,
        gatewaySecret: config.appsScriptGatewaySecret,
        gatewayIdentity: {
          email: identity.email,
          googleSub: identity.googleSub,
          ...(identity.name ? { name: identity.name } : {}),
        },
      }),
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
    })
    if ([301, 302, 303].includes(upstream.status)) {
      const location = upstream.headers.get('Location')
      if (!location) throw new Error('Apps Script redirect was missing a destination')
      const redirectUrl = new URL(location, config.appsScriptUrl)
      if (redirectUrl.protocol !== 'https:' || redirectUrl.hostname !== 'script.googleusercontent.com') {
        throw new Error('Apps Script returned an untrusted redirect')
      }
      upstream = await fetchImplementation(redirectUrl, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
      })
    } else if ([307, 308].includes(upstream.status)) {
      throw new Error('Apps Script returned an unsafe redirect')
    }
    if (!upstream.ok) throw new Error(`Apps Script returned HTTP ${upstream.status}`)
    const text = await readLimitedResponseText(upstream)
    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error('Apps Script returned a non-JSON response')
    }
    return { body: redactSensitiveResponse(body, config.appsScriptGatewaySecret, config.appsScriptUrl), status: upstream.status }
  } finally {
    clearTimeout(timeout)
  }
}
