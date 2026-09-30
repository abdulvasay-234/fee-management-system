import type { Env, GatewayConfig } from './types'

function required(value: string | undefined, name: string) {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`Missing required binding: ${name}`)
  return normalized
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function loadConfig(env: Env): GatewayConfig {
  const allowedEmails = new Set(
    required(env.ALLOWED_EMAILS, 'ALLOWED_EMAILS')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean),
  )
  if (!allowedEmails.size) throw new Error('ALLOWED_EMAILS must contain at least one email')

  const allowedOrigins = new Set(required(env.ALLOWED_ORIGIN, 'ALLOWED_ORIGIN').split(',').map((value) => {
    const parsedOrigin = new URL(value.trim())
    const isLocalDevelopment = parsedOrigin.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsedOrigin.hostname)
    if (parsedOrigin.protocol !== 'https:' && !isLocalDevelopment) {
      throw new Error('ALLOWED_ORIGIN must use HTTPS except for localhost development')
    }
    return parsedOrigin.origin
  }))
  const appsScriptUrl = required(env.APPS_SCRIPT_URL, 'APPS_SCRIPT_URL')
  const parsedAppsScriptUrl = new URL(appsScriptUrl)
  if (
    parsedAppsScriptUrl.protocol !== 'https:' ||
    parsedAppsScriptUrl.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(parsedAppsScriptUrl.pathname)
  ) {
    throw new Error('APPS_SCRIPT_URL must be a script.google.com /macros/s/.../exec URL')
  }

  const appsScriptGatewaySecret = required(env.APPS_SCRIPT_GATEWAY_SECRET, 'APPS_SCRIPT_GATEWAY_SECRET')
  if (appsScriptGatewaySecret.length < 32) throw new Error('APPS_SCRIPT_GATEWAY_SECRET must be at least 32 characters')

  return {
    allowedEmails,
    allowedOrigins,
    appsScriptGatewaySecret,
    appsScriptUrl,
    googleClientId: required(env.GOOGLE_CLIENT_ID, 'GOOGLE_CLIENT_ID'),
  }
}
