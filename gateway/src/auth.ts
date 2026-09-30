import type { NextFunction, Request, Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import type { GatewayConfig } from './config.js'
import { normalizeEmail } from './config.js'

export interface VerifiedGoogleClaims {
  aud?: string
  email?: string
  email_verified?: boolean
  exp?: number
  iss?: string
  name?: string
  sub?: string
}

export interface AuthenticatedIdentity {
  email: string
  googleSub: string
  name?: string
}

export interface TokenVerifier {
  verify(token: string, audience: string): Promise<VerifiedGoogleClaims>
}

export class GoogleTokenVerifier implements TokenVerifier {
  private readonly client = new OAuth2Client()

  async verify(token: string, audience: string): Promise<VerifiedGoogleClaims> {
    const ticket = await this.client.verifyIdToken({ idToken: token, audience })
    return ticket.getPayload() ?? {}
  }
}

export interface AuthenticatedRequest extends Request {
  identity?: AuthenticatedIdentity
}

function bearerToken(header: string | undefined) {
  if (!header) return null
  const match = /^Bearer ([^\s]+)$/.exec(header)
  return match?.[1] ?? null
}

export function createAuthenticationMiddleware(config: GatewayConfig, verifier: TokenVerifier) {
  return async (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
    const token = bearerToken(request.header('authorization'))
    if (!token) {
      response.status(401).json({ error: 'Authentication required' })
      return
    }

    try {
      const claims = await verifier.verify(token, config.googleClientId)
      const now = Math.floor(Date.now() / 1000)
      const validIssuer = claims.iss === 'accounts.google.com' || claims.iss === 'https://accounts.google.com'
      const validAudience = claims.aud === config.googleClientId
      if (!claims.sub || !claims.email || claims.email_verified !== true || !claims.exp || claims.exp <= now || !validIssuer || !validAudience) {
        response.status(401).json({ error: 'Authentication required' })
        return
      }

      const email = normalizeEmail(claims.email)
      if (!config.allowedEmails.has(email)) {
        response.status(403).json({ error: 'Access denied' })
        return
      }

      request.identity = {
        email,
        googleSub: claims.sub,
        ...(claims.name ? { name: claims.name } : {}),
      }
      next()
    } catch {
      response.status(401).json({ error: 'Authentication required' })
    }
  }
}
