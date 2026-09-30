import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { authenticateRequest, bearerToken, verifyGoogleIdToken } from '../src/auth'
import type { GatewayConfig } from '../src/types'

const config: GatewayConfig = {
  allowedEmails: new Set(['approved@gmail.com']),
  allowedOrigins: new Set(['https://example.github.io']),
  appsScriptGatewaySecret: 's'.repeat(32),
  appsScriptUrl: 'https://script.google.com/macros/s/test/exec',
  googleClientId: 'client.apps.googleusercontent.com',
}

let privateKey: CryptoKey
let alternatePrivateKey: CryptoKey
let keyResolver: ReturnType<typeof createLocalJWKSet>

beforeAll(async () => {
  const primary = await generateKeyPair('RS256', { extractable: true })
  const alternate = await generateKeyPair('RS256', { extractable: true })
  privateKey = primary.privateKey
  alternatePrivateKey = alternate.privateKey
  const publicJwk = await exportJWK(primary.publicKey)
  keyResolver = createLocalJWKSet({ keys: [{ ...publicJwk, alg: 'RS256', kid: 'primary', use: 'sig' }] })
})

async function token(overrides: Record<string, unknown> = {}, signingKey = privateKey) {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    aud: config.googleClientId,
    email: 'Approved@Gmail.com',
    email_verified: true,
    exp: now + 3600,
    iat: now,
    iss: 'https://accounts.google.com',
    name: 'Approved User',
    sub: 'google-subject-1',
    ...overrides,
  }
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'primary' })
    .sign(signingKey)
}

function authRequest(value?: string) {
  return new Request('https://worker.example/api', { headers: value ? { Authorization: value } : {} })
}

describe('Google ID token authentication', () => {
  it('cryptographically verifies a valid RS256 Google identity', async () => {
    await expect(verifyGoogleIdToken(await token(), config.googleClientId, keyResolver)).resolves.toEqual({
      email: 'approved@gmail.com',
      googleSub: 'google-subject-1',
      name: 'Approved User',
    })
  })

  it('rejects an invalid signature', async () => {
    await expect(verifyGoogleIdToken(await token({}, alternatePrivateKey), config.googleClientId, keyResolver)).rejects.toThrow()
  })

  it('rejects a tampered token', async () => {
    const valid = await token()
    const parts = valid.split('.')
    parts[1] = `${parts[1]?.slice(0, -1)}${parts[1]?.endsWith('a') ? 'b' : 'a'}`
    await expect(verifyGoogleIdToken(parts.join('.'), config.googleClientId, keyResolver)).rejects.toThrow()
  })

  it.each([
    ['wrong issuer', { iss: 'https://attacker.example' }],
    ['wrong audience', { aud: 'wrong-client' }],
    ['expired', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['missing subject', { sub: '' }],
    ['missing email', { email: '' }],
    ['unverified email', { email_verified: false }],
  ])('rejects %s', async (_label, overrides) => {
    await expect(verifyGoogleIdToken(await token(overrides), config.googleClientId, keyResolver)).rejects.toThrow()
  })

  it('fails closed when JWKS resolution fails', async () => {
    const failingResolver = async () => { throw new Error('JWKS unavailable') }
    await expect(verifyGoogleIdToken(await token(), config.googleClientId, failingResolver)).rejects.toThrow('JWKS unavailable')
  })

  it('rejects missing and malformed Authorization headers', () => {
    expect(bearerToken(null)).toBeNull()
    expect(bearerToken('invalid')).toBeNull()
    expect(bearerToken('Bearer')).toBeNull()
  })

  it('accepts approved email and rejects unapproved email', async () => {
    const validToken = await token()
    const verifier = (value: string, audience: string) => verifyGoogleIdToken(value, audience, keyResolver)
    const approved = await authenticateRequest(authRequest(`Bearer ${validToken}`), config, verifier)
    if (!('identity' in approved)) throw new Error('Approved identity was rejected')
    expect(approved.identity.email).toBe('approved@gmail.com')

    const unapprovedToken = await token({ email: 'other@gmail.com' })
    const unapproved = await authenticateRequest(authRequest(`Bearer ${unapprovedToken}`), config, verifier)
    expect(unapproved).toEqual({ error: 'Access denied', status: 403 })
  })
})
