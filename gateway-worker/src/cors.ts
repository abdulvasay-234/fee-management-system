export function corsHeaders(origin: string | null, allowedOrigins: ReadonlySet<string>) {
  if (!origin || !allowedOrigins.has(origin)) return new Headers()
  return new Headers({
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
  })
}

export function jsonResponse(body: unknown, status: number, origin: string | null, allowedOrigins: ReadonlySet<string>) {
  const headers = corsHeaders(origin, allowedOrigins)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers })
}
