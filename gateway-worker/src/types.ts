export interface Env {
  ALLOWED_EMAILS: string
  ALLOWED_ORIGIN: string
  APPS_SCRIPT_GATEWAY_SECRET: string
  APPS_SCRIPT_URL: string
  GOOGLE_CLIENT_ID: string
}

export interface GatewayConfig {
  allowedEmails: ReadonlySet<string>
  allowedOrigins: ReadonlySet<string>
  appsScriptGatewaySecret: string
  appsScriptUrl: string
  googleClientId: string
}

export interface AuthenticatedIdentity {
  email: string
  googleSub: string
  name?: string
}

export interface ProxyRequest {
  action: string
  method: 'GET' | 'POST'
  parameters: Record<string, unknown>
}

export interface ProxyResponse {
  body: unknown
  status: number
}

export type VerifyToken = (token: string, audience: string) => Promise<AuthenticatedIdentity>
export type FetchImplementation = typeof fetch
