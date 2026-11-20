let googleIdentityPromise: Promise<GoogleAccountsId> | null = null
let initializedClientId: string | null = null
let activeCredentialCallback: ((response: GoogleCredentialResponse) => void) | null = null

export function loadGoogleIdentityServices() {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id)
  if (googleIdentityPromise) return googleIdentityPromise

  googleIdentityPromise = new Promise<GoogleAccountsId>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-lsa-google-identity]')
    const script = existingScript ?? document.createElement('script')

    function handleLoad() {
      if (window.google?.accounts.id) resolve(window.google.accounts.id)
      else reject(new Error('Google Identity Services did not initialize.'))
    }

    function handleError() {
      googleIdentityPromise = null
      script.remove()
      reject(new Error('Unable to load Google Sign-In.'))
    }

    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    if (!existingScript) {
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.dataset.lsaGoogleIdentity = 'true'
      document.head.appendChild(script)
    }
  })

  return googleIdentityPromise
}

export async function initializeGoogleIdentityServices(
  clientId: string,
  callback: (response: GoogleCredentialResponse) => void,
) {
  const accounts = await loadGoogleIdentityServices()
  activeCredentialCallback = callback

  if (initializedClientId !== clientId) {
    accounts.initialize({
      client_id: clientId,
      cancel_on_tap_outside: true,
      callback: (response) => activeCredentialCallback?.(response),
    })
    initializedClientId = clientId
  }

  return accounts
}
