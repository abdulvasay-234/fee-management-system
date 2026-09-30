import { cloudflareTest } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

process.env.APPS_SCRIPT_GATEWAY_SECRET ||= 'test-only-secret-value-1234567890'
process.env.ALLOWED_EMAILS ||= 'approved@gmail.com'
process.env.APPS_SCRIPT_URL ||= 'https://script.google.com/macros/s/test/exec'

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          ALLOWED_EMAILS: 'approved@gmail.com',
          ALLOWED_ORIGIN: 'https://example.github.io',
          APPS_SCRIPT_GATEWAY_SECRET: 's'.repeat(32),
          APPS_SCRIPT_URL: 'https://script.google.com/macros/s/test/exec',
          GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com',
        },
      },
    }),
  ],
  test: {
    include: ['test/**/*.test.ts'],
  },
})
