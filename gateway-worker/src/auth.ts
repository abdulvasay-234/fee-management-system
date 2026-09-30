import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'
import { normalizeEmail } from './config'
import type { AuthenticatedIdentity, GatewayConfig } from './types'

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com']

export type AuthenticationResult =
  | { identity: AuthenticatedIdentity }
  | { error: 'Access denied' | 'Authentication required'; status: 401 | 403 }

export function bearerToken(header: string | null) {
  if (!header) return null
  return /^Bearer ([^\s]+)$/.exec(header)?.[1] ?? null
}

export async function verifyGoogleIdToken(
  token: string,
  audience: string,
  keyResolver: JWTVerifyGetKey = GOOGLE_JWKS,
): Promise<AuthenticatedIdentity> {
  const { payload } = await jwtVerify(token, keyResolver, {
    algorithms: ['RS256'],
    audience,
    issuer: GOOGLE_ISSUERS,
  })
  const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : ''
  if (!payload.sub || !email || payload.email_verified !== true || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Invalid Google identity')
  }
  return {
    email,
    googleSub: payload.sub,
    ...(typeof payload.name === 'string' ? { name: payload.name } : {}),
  }
}

export async function authenticateRequest(
  request: Request,
  config: GatewayConfig,
  verifier = verifyGoogleIdToken,
): Promise<AuthenticationResult> {
  const token = bearerToken(request.headers.get('Authorization'))
  if (!token) return { error: 'Authentication required', status: 401 } as const
  try {
    const identity = await verifier(token, config.googleClientId)
    if (!config.allowedEmails.has(identity.email)) return { error: 'Access denied', status: 403 } as const
    return { identity } as const
  } catch {
    return { error: 'Authentication required', status: 401 } as const
  }
}
