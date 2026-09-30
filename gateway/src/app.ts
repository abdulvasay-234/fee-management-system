import express, { type NextFunction, type Request, type Response } from 'express'
import type { AuthenticatedRequest, TokenVerifier } from './auth.js'
import { createAuthenticationMiddleware } from './auth.js'
import type { GatewayConfig } from './config.js'
import type { AppsScriptProxy, ProxyRequest } from './appsScript.js'
import { isAllowedAction } from './appsScript.js'
import { createCorsMiddleware } from './cors.js'

function queryParameters(request: Request) {
  const parameters: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(request.query)) {
    if (key === 'action' || value === undefined) continue
    parameters[key] = Array.isArray(value) ? value[0] : value
  }
  return parameters
}

function postBody(request: Request) {
  if (typeof request.body === 'string') {
    try {
      return JSON.parse(request.body) as Record<string, unknown>
    } catch {
      throw Object.assign(new Error('Invalid JSON request body'), { status: 400 })
    }
  }
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw Object.assign(new Error('Invalid JSON request body'), { status: 400 })
  }
  return request.body as Record<string, unknown>
}

export function createApp(config: GatewayConfig, verifier: TokenVerifier, proxy: AppsScriptProxy) {
  const app = express()
  app.disable('x-powered-by')
  app.use(createCorsMiddleware(config.allowedOrigin))
  app.use(express.json({ limit: '100kb' }))
  app.use(express.text({ limit: '100kb', type: 'text/plain' }))

  app.get('/health', (_request, response) => {
    response.json({ ok: true })
  })

  const authenticate = createAuthenticationMiddleware(config, verifier)
  app.all('/api', authenticate, async (request: AuthenticatedRequest, response, next) => {
    try {
      const method = request.method as 'GET' | 'POST'
      if (method !== 'GET' && method !== 'POST') {
        response.status(405).json({ error: 'Method not allowed' })
        return
      }

      const body = method === 'POST' ? postBody(request) : null
      const action = String(method === 'GET' ? request.query.action ?? '' : body?.action ?? '').trim()
      if (!action || !isAllowedAction(method, action)) {
        response.status(400).json({ error: 'Unsupported API action' })
        return
      }

      const parameters = method === 'GET' ? queryParameters(request) : { ...body }
      delete parameters.action
      delete parameters.gatewaySecret
      delete parameters.gatewayIdentity
      const proxyRequest: ProxyRequest = { action, method, parameters }
      const result = await proxy.forward(proxyRequest, request.identity!)
      response.status(result.status).json(result.body)
    } catch (error) {
      next(error)
    }
  })

  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' })
  })

  app.use((error: unknown, request: Request, response: Response, _next: NextFunction) => {
    const status = typeof error === 'object' && error && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 502
    console.error(JSON.stringify({ event: 'gateway_request_failed', method: request.method, path: request.path, status }))
    if (status === 400) {
      response.status(400).json({ error: 'Invalid request body' })
      return
    }
    if (status === 413) {
      response.status(413).json({ error: 'Request body too large' })
      return
    }
    response.status(502).json({ error: 'Upstream service unavailable' })
  })

  return app
}
