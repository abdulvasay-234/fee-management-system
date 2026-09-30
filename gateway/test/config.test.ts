import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config.js'

const environment = {
  ALLOWED_EMAILS: ' First.User@Gmail.com,second@gmail.com ',
  ALLOWED_ORIGIN: 'https://example.github.io/path',
  APPS_SCRIPT_GATEWAY_SECRET: 's'.repeat(32),
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec',
  GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
  PORT: '8080',
}

describe('configuration', () => {
  it('normalizes allowlisted emails and origin', () => {
    const config = loadConfig(environment)
    expect([...config.allowedEmails]).toEqual(['first.user@gmail.com', 'second@gmail.com'])
    expect(config.allowedOrigin).toBe('https://example.github.io')
  })

  it('requires all security configuration', () => {
    expect(() => loadConfig({})).toThrow('Missing required environment variable')
  })

  it('rejects a short gateway secret', () => {
    expect(() => loadConfig({ ...environment, APPS_SCRIPT_GATEWAY_SECRET: 'short' })).toThrow(
      'APPS_SCRIPT_GATEWAY_SECRET must be at least 32 characters',
    )
  })

  it('rejects a non-Apps-Script secret destination', () => {
    expect(() => loadConfig({ ...environment, APPS_SCRIPT_URL: 'https://attacker.example/collect' })).toThrow(
      'APPS_SCRIPT_URL must be a script.google.com',
    )
  })
})
