const GOOGLE_CLIENT_ID = '1048697738548-l681khi72a68o1fp2np80kpet911scn6.apps.googleusercontent.com'
const WORKER_API_URL = 'https://lsa-api-gateway.lsa-416.workers.dev/api?action=course-codes'
const SENSITIVE_KEYS = new Set(['authorization', 'credential', 'gatewayidentity', 'gatewaysecret', 'idtoken', 'stack', 'stacktrace'])

let idToken = null

const authStatus = document.querySelector('#auth-status')
const emailOutput = document.querySelector('#email')
const requestCountOutput = document.querySelector('#request-count')
const requestMethodOutput = document.querySelector('#request-method')
const requestUrlOutput = document.querySelector('#request-url')
const requestBodyOutput = document.querySelector('#request-body')
const workerStatus = document.querySelector('#worker-status')
const responseHeadersOutput = document.querySelector('#response-headers')
const workerResponse = document.querySelector('#worker-response')

let requestCount = 0

function setText(element, value, className = '') {
  element.textContent = value
  element.className = className
}

function displayEmail(token) {
  try {
    const encoded = token.split('.')[1]
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), character => character.charCodeAt(0))
    const payload = JSON.parse(new TextDecoder().decode(bytes))
    return typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : 'Unavailable'
  } catch {
    return 'Unavailable'
  }
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, sanitize(item)]),
  )
}

async function callWorker(token) {
  const request = new Request(WORKER_API_URL, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  })
  requestCount += 1
  setText(requestCountOutput, String(requestCount))
  setText(requestMethodOutput, request.method)
  setText(requestUrlOutput, request.url)
  setText(requestBodyOutput, request.body === null ? 'No' : 'Yes')
  const response = await fetch(request)
  setText(workerStatus, String(response.status), response.ok ? 'passed' : 'failed')
  setText(responseHeadersOutput, JSON.stringify({
    'content-type': response.headers.get('content-type'),
    'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
    'www-authenticate': response.headers.get('www-authenticate'),
  }))
  let body
  try {
    body = sanitize(await response.json())
  } catch {
    body = { error: 'Worker returned a non-JSON response' }
  }
  setText(workerResponse, JSON.stringify(body, null, 2))
  if (!response.ok) throw new Error('The Worker rejected the authenticated request.')
}

async function handleCredential(response) {
  idToken = response.credential
  setText(authStatus, 'Google sign-in succeeded; verifying with Worker…', 'passed')
  setText(emailOutput, displayEmail(idToken))
  setText(workerStatus, 'Requesting…')
  setText(workerResponse, '—')
  try {
    await callWorker(idToken)
    setText(authStatus, 'Google authentication and Worker authorization succeeded', 'passed')
  } catch (error) {
    setText(authStatus, error instanceof Error ? error.message : 'Authentication failed', 'failed')
  }
}

function loadGoogleIdentityServices() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve(window.google.accounts.id)
    script.onerror = () => reject(new Error('Unable to load Google Identity Services.'))
    document.head.appendChild(script)
  })
}

try {
  const googleIdentity = await loadGoogleIdentityServices()
  googleIdentity.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredential })
  googleIdentity.renderButton(document.querySelector('#google-button'), {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    width: 320,
  })
} catch (error) {
  setText(authStatus, error instanceof Error ? error.message : 'Google authentication failed', 'failed')
}

window.addEventListener('pagehide', () => { idToken = null }, { once: true })
