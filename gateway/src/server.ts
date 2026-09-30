import 'dotenv/config'
import { createApp } from './app.js'
import { AppsScriptClient } from './appsScript.js'
import { GoogleTokenVerifier } from './auth.js'
import { loadConfig } from './config.js'

const config = loadConfig()
const app = createApp(
  config,
  new GoogleTokenVerifier(),
  new AppsScriptClient(config.appsScriptUrl, config.appsScriptGatewaySecret),
)

app.listen(config.port, '0.0.0.0', () => {
  console.log(`LSA API gateway listening on port ${config.port}`)
})
