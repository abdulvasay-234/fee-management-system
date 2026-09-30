import type { NextFunction, Request, Response } from 'express'

export function createCorsMiddleware(allowedOrigin: string) {
  return (request: Request, response: Response, next: NextFunction) => {
    const origin = request.header('origin')
    if (origin && origin !== allowedOrigin) {
      response.status(403).json({ error: 'Origin not allowed' })
      return
    }

    if (origin === allowedOrigin) {
      response.setHeader('Access-Control-Allow-Origin', allowedOrigin)
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.setHeader('Vary', 'Origin')
    }

    if (request.method === 'OPTIONS') {
      response.status(204).end()
      return
    }

    next()
  }
}
