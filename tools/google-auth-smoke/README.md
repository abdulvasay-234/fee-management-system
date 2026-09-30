# Temporary Google authentication smoke test

This isolated page is not imported by the React application and is not part of the Vite production build.

Run from the repository root:

```sh
python3 -m http.server 5173 --bind localhost --directory tools/google-auth-smoke
```

Open <http://localhost:5173> and use an approved Google OAuth test account.

The page keeps the Google ID token in module memory only, performs one read-only `GET /api?action=course-codes` request to the Cloudflare Worker, does not log the token, and clears its reference on page exit.

Delete `tools/google-auth-smoke/` after the real browser smoke test is complete.
