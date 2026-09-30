# LSA API Gateway — Cloudflare Worker

Native TypeScript Cloudflare Worker that authenticates LSA staff with Google ID tokens and proxies allowlisted actions to the protected Apps Script backend.

The existing `gateway/` Cloud Run implementation is intentionally preserved for comparison and rollback.

## Security flow

1. Browser sends `Authorization: Bearer <Google ID token>` to `/api`.
2. Worker verifies the RS256 signature with Google's remote JWKS using `jose`.
3. Worker verifies issuer, audience, expiration, subject, email and `email_verified`.
4. Worker checks normalized email against `ALLOWED_EMAILS`.
5. Worker allowlists the action and removes browser-controlled identity/audit fields.
6. Worker POSTs a protected envelope to Apps Script containing the server-only secret and verified identity.

`GET /health` is public and returns only `{ "ok": true }`.

## Bindings

Secrets:

- `APPS_SCRIPT_GATEWAY_SECRET`
- `ALLOWED_EMAILS`
- `APPS_SCRIPT_URL`

Variables:

- `GOOGLE_CLIENT_ID`
- `ALLOWED_ORIGIN`

Production values must not be committed. Copy `.dev.vars.example` to the ignored `.dev.vars` only for local development. Set production secrets through Cloudflare's encrypted Worker secret bindings.

## Commands

```sh
npm install
npm run types
npm run typecheck
npm test
npm run build       # Wrangler dry-run only; does not deploy
npm run dry-run     # Same dry-run with bundle metrics
npm run dev         # Local workerd runtime
```

No deploy script is defined intentionally.

## Worker configuration

Before a future deployment:

1. Replace the safe `GOOGLE_CLIENT_ID` and `ALLOWED_ORIGIN` placeholders in `wrangler.jsonc` or configure environment-specific vars.
2. Configure all three required secrets.
3. Keep `APPS_SCRIPT_URL` restricted to the existing `https://script.google.com/macros/s/.../exec` endpoint.
4. Keep the Worker route fail-closed.
5. Set the frontend `VITE_API_BASE_URL` to the Worker `/api` URL only after end-to-end verification.

## Free-plan limits

The design uses one Apps Script subrequest per normal invocation and one additional Google JWKS subrequest when the in-isolate JWKS cache is cold or stale. This is below the Free plan's 50-subrequest limit, 128 MB memory limit and 64 MiB bundle limit.

The Free plan CPU limit is 10 ms per request. Local Miniflare/workerd tests cannot prove remote CPU consumption. Before production cutover, benchmark cold and warm JWT verification on a preview Worker and inspect Cloudflare CPU metrics. Do not claim Free-plan readiness until this measurement passes.

## Test tooling note

The requested `@cloudflare/vitest-pool-workers` package currently pulls dependencies with high-severity advisories. This project uses Cloudflare's supported successor, `@cloudflare/vitest-plugin`, which runs tests in the same workerd/Miniflare Worker runtime and audits cleanly.
