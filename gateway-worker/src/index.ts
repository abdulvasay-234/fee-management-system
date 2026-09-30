import { isAllowedAction } from './actions'
import { authenticateRequest, verifyGoogleIdToken } from './auth'
import { forwardToAppsScript } from './appsScript'
import { loadConfig } from './config'
import { corsHeaders, jsonResponse } from './cors'
import type { AuthenticatedIdentity, Env, GatewayConfig, ProxyRequest, ProxyResponse, VerifyToken } from './types'

const MAX_REQUEST_BODY_BYTES = 100 * 1024
const PROHIBITED_PARAMETER_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const RESERVED_PARAMETER_KEYS = new Set(['action', 'createdBy', 'gatewayIdentity', 'gatewaySecret', 'googleSub'])

type ForwardRequest = (
  request: ProxyRequest,
  identity: AuthenticatedIdentity,
  config: GatewayConfig,
) => Promise<ProxyResponse>

export interface GatewayDependencies {
  forwardRequest?: ForwardRequest
  verifyToken?: VerifyToken
}

function copyParameters(source: Record<string, unknown>) {
  const parameters: Record<string, unknown> = Object.create(null)
  for (const [key, value] of Object.entries(source)) {
    if (PROHIBITED_PARAMETER_KEYS.has(key)) throw new Error('Invalid request parameters')
    if (!RESERVED_PARAMETER_KEYS.has(key)) parameters[key] = value
  }
  return parameters
}

function queryParameters(url: URL) {
  const parameters: Record<string, unknown> = Object.create(null)
  for (const [key, value] of url.searchParams) {
    if (PROHIBITED_PARAMETER_KEYS.has(key)) throw new Error('Invalid request parameters')
    if (!RESERVED_PARAMETER_KEYS.has(key) && !(key in parameters)) parameters[key] = value
  }
  return parameters
}

async function readLimitedText(stream: ReadableStream<Uint8Array> | null, maximumBytes: number) {
  if (!stream) return ''
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > maximumBytes) {
      await reader.cancel()
      throw Object.assign(new Error('Request body too large'), { status: 413 })
    }
    text += decoder.decode(value, { stream: true })
  }
  return text + decoder.decode()
}

async function readJsonBody(request: Request) {
  const contentLength = Number(request.headers.get('Content-Length') || 0)
  if (contentLength > MAX_REQUEST_BODY_BYTES) throw Object.assign(new Error('Request body too large'), { status: 413 })
  const text = await readLimitedText(request.body, MAX_REQUEST_BODY_BYTES)
  try {
    const body = JSON.parse(text) as unknown
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Invalid JSON body')
    return body as Record<string, unknown>
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 })
  }
}

export function createGatewayHandler(dependencies: GatewayDependencies = {}) {
  const verifyToken = dependencies.verifyToken ?? verifyGoogleIdToken
  const forwardRequest = dependencies.forwardRequest ?? forwardToAppsScript

  return async function handleRequest(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname === '/health' && request.method === 'GET') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    let config: GatewayConfig
    try {
      config = loadConfig(env)
    } catch {
      return new Response(JSON.stringify({ error: 'Service unavailable' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    const origin = request.headers.get('Origin')
    if (origin && !config.allowedOrigins.has(origin)) {
      return jsonResponse({ error: 'Origin not allowed' }, 403, origin, config.allowedOrigins)
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, config.allowedOrigins) })
    }

    if (url.pathname !== '/api') return jsonResponse({ error: 'Not found' }, 404, origin, config.allowedOrigins)

    const authentication = await authenticateRequest(request, config, verifyToken)
    if ('error' in authentication) {
      return jsonResponse({ error: authentication.error }, authentication.status, origin, config.allowedOrigins)
    }

    try {
      if (request.method !== 'GET' && request.method !== 'POST') {
        return jsonResponse({ error: 'Method not allowed' }, 405, origin, config.allowedOrigins)
      }

      let action: string
      let parameters: Record<string, unknown>
      if (request.method === 'GET') {
        action = String(url.searchParams.get('action') || '').trim()
        parameters = queryParameters(url)
      } else {
        const body = await readJsonBody(request)
        action = String(body.action || '').trim()
        parameters = copyParameters(body)
      }

      if (!action || !isAllowedAction(request.method, action)) {
        return jsonResponse({ error: 'Unsupported API action' }, 400, origin, config.allowedOrigins)
      }

      const result = await forwardRequest(
        { action, method: request.method, parameters },
        authentication.identity,
        config,
      )
      return jsonResponse(result.body, result.status, origin, config.allowedOrigins)
    } catch (error) {
      const status = typeof error === 'object' && error && 'status' in error && error.status === 413 ? 413 :
        typeof error === 'object' && error && 'status' in error && error.status === 400 ? 400 : 502
      const message = status === 413 ? 'Request body too large' : status === 400 ? 'Invalid request body' : 'Upstream service unavailable'
      return jsonResponse({ error: message }, status, origin, config.allowedOrigins)
    }
  }
}

const handleRequest = createGatewayHandler()

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env)
  },
} satisfies ExportedHandler<Env>
