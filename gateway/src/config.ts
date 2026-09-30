export interface GatewayConfig {
  allowedEmails: ReadonlySet<string>
  allowedOrigin: string
  appsScriptGatewaySecret: string
  appsScriptUrl: string
  googleClientId: string
  port: number
}

function required(env: NodeJS.ProcessEnv, name: string) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const allowedEmails = new Set(
    required(env, 'ALLOWED_EMAILS')
      .split(',')
      .map(normalizeEmail)
      .filter(Boolean),
  )
  if (allowedEmails.size === 0) throw new Error('ALLOWED_EMAILS must contain at least one email')

  const allowedOrigin = new URL(required(env, 'ALLOWED_ORIGIN')).origin
  const appsScriptUrl = required(env, 'APPS_SCRIPT_URL')
  const parsedAppsScriptUrl = new URL(appsScriptUrl)
  if (
    parsedAppsScriptUrl.protocol !== 'https:' ||
    parsedAppsScriptUrl.hostname !== 'script.google.com' ||
    !/^\/macros\/s\/[^/]+\/exec$/.test(parsedAppsScriptUrl.pathname)
  ) {
    throw new Error('APPS_SCRIPT_URL must be a script.google.com /macros/s/.../exec URL')
  }

  const appsScriptGatewaySecret = required(env, 'APPS_SCRIPT_GATEWAY_SECRET')
  if (appsScriptGatewaySecret.length < 32) {
    throw new Error('APPS_SCRIPT_GATEWAY_SECRET must be at least 32 characters')
  }

  const port = Number(env.PORT || 8080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port')

  return {
    allowedEmails,
    allowedOrigin,
    appsScriptGatewaySecret,
    appsScriptUrl,
    googleClientId: required(env, 'GOOGLE_CLIENT_ID'),
    port,
  }
}
