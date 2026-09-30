# LSA API Gateway

Cloud Run authentication and API gateway for the LSA Fee Management application.

## Request flow

1. The browser obtains a Google Identity Services ID token.
2. The browser calls `GET|POST /api` with `Authorization: Bearer <ID token>`.
3. The gateway verifies the token with `google-auth-library`, validates claims, and checks the email allowlist.
4. The gateway forwards an authenticated POST envelope to Apps Script.

`GET /health` is public and returns only `{ "ok": true }`.

## Required configuration

Copy `.env.example` to `.env` for local development and set:

- `GOOGLE_CLIENT_ID`: Web OAuth client ID used by Google Identity Services.
- `ALLOWED_EMAILS`: Comma-separated approved Gmail addresses.
- `ALLOWED_ORIGIN`: Exact production GitHub Pages origin, without a path.
- `APPS_SCRIPT_URL`: Existing Apps Script `/exec` URL.
- `APPS_SCRIPT_GATEWAY_SECRET`: At least 32 random characters. In production, inject this from Secret Manager.
- `PORT`: Defaults to `8080`.

Never commit `.env`, OAuth client secrets, ID tokens, or the gateway secret.

## Local commands

```sh
npm install
npm run typecheck
npm run build
npm test
npm run dev
```

## Google Cloud configuration

1. Use a Google Cloud project controlled by LSA.
2. Configure the OAuth consent screen for the intended staff users.
3. Create a **Web application** OAuth client.
4. Add the production GitHub Pages origin and local development origin to **Authorized JavaScript origins**.
5. A redirect URI is not required for the GIS JavaScript callback flow used by the planned frontend integration.
6. Enable Cloud Run and Secret Manager APIs.
7. Store `APPS_SCRIPT_GATEWAY_SECRET` and `ALLOWED_EMAILS` in Secret Manager and grant only the Cloud Run runtime service account access.
8. Configure the remaining non-secret variables on the Cloud Run service.
9. Cloud Run must be browser reachable; authorization is enforced by this application using the verified Google ID token.

## Required Apps Script cutover before deployment

The current Apps Script backend does not yet enforce the gateway boundary. Before pointing the frontend at Cloud Run:

1. Store the same gateway secret in Apps Script Properties.
2. Make `doPost` reject missing or incorrect `gatewaySecret` before any data access.
3. Read `gatewayIdentity` only after the secret is validated.
4. Route read actions (`students`, `payments`, `dashboard`, `walkins`, and `followups`) from the POST body.
5. Derive audit fields such as `createdBy` from the validated gateway identity.
6. Keep the minimal health response public only if operational monitoring requires it.
7. Verify that direct calls to the Apps Script URL cannot access administrative actions.

Until those changes are reviewed and deployed, the gateway must not be treated as the sole API boundary.
