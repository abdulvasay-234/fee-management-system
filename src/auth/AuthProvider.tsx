import { useEffect, useState, type ReactNode } from 'react'
import { ApiHttpError, validateCredential } from '../services/api'
import { AuthContext, type AuthStatus, type AuthUser } from './AuthContext'
import { clearIdToken, setAuthFailureHandler, setIdToken } from './authService'
import { loadGoogleIdentityServices } from './googleIdentity'

interface GoogleDisplayClaims {
  email?: unknown
  name?: unknown
  picture?: unknown
  sub?: unknown
}

function readDisplayClaims(token: string): AuthUser | null {
  try {
    const encodedPayload = token.split('.')[1]
    if (!encodedPayload) return null
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as GoogleDisplayClaims
    if (typeof claims.email !== 'string' || typeof claims.sub !== 'string') return null
    return {
      email: claims.email.trim().toLowerCase(),
      googleSub: claims.sub,
      ...(typeof claims.name === 'string' ? { name: claims.name } : {}),
      ...(typeof claims.picture === 'string' ? { picture: claims.picture } : {}),
    }
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
  const [status, setStatus] = useState<AuthStatus>(clientId ? 'loading' : 'unauthenticated')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState(clientId ? '' : 'Google Sign-In is not configured for this application.')
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccountsId | null>(null)

  useEffect(() => setAuthFailureHandler((failure) => {
    setToken(null)
    if (failure === 'accessDenied') {
      setStatus('accessDenied')
      setError('Your Google account is not authorized to access this application.')
      return
    }
    setUser(null)
    setStatus('unauthenticated')
    setError('Your session has expired. Please sign in again.')
  }), [])

  useEffect(() => {
    let active = true
    if (!clientId) {
      return () => { active = false }
    }

    void loadGoogleIdentityServices().then((accounts) => {
      if (!active) return
      accounts.initialize({
        client_id: clientId,
        cancel_on_tap_outside: true,
        callback: (response) => {
          const candidateUser = readDisplayClaims(response.credential)
          setError('')
          setStatus('loading')
          void validateCredential(response.credential).then(() => {
            if (!active) return
            if (!candidateUser) throw new Error('Google did not return a usable identity.')
            setIdToken(response.credential)
            setToken(response.credential)
            setUser(candidateUser)
            setStatus('authenticated')
          }).catch((cause: unknown) => {
            if (!active) return
            clearIdToken()
            setToken(null)
            if (cause instanceof ApiHttpError && cause.status === 403) {
              setUser(candidateUser)
              setStatus('accessDenied')
              setError('Your Google account is not authorized to access this application.')
              return
            }
            setUser(null)
            setStatus('unauthenticated')
            setError(cause instanceof ApiHttpError && cause.status === 401
              ? 'Google authentication could not be verified. Please try again.'
              : 'Unable to complete sign-in. Please try again.')
          })
        },
      })
      setGoogleAccounts(accounts)
      setStatus('unauthenticated')
    }).catch((cause: unknown) => {
      if (!active) return
      setError(cause instanceof Error ? cause.message : 'Unable to load Google Sign-In.')
      setStatus('unauthenticated')
    })

    return () => { active = false }
  }, [clientId])

  function signOut() {
    clearIdToken()
    setToken(null)
    setUser(null)
    setError('')
    setStatus('unauthenticated')
    googleAccounts?.disableAutoSelect()
  }

  function signIn() {
    setError('')
    if (!googleAccounts) {
      window.location.reload()
      return
    }
    googleAccounts?.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        setError('Google Sign-In was not completed. Use the Google button to try again.')
      }
    })
  }

  function renderGoogleButton(element: HTMLElement) {
    if (!googleAccounts) return
    element.replaceChildren()
    const width = Math.max(200, Math.min(320, Math.floor(element.getBoundingClientRect().width || 320)))
    googleAccounts.renderButton(element, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      width,
    })
  }

  return (
    <AuthContext value={{
      email: user?.email ?? null,
      error,
      idToken: token,
      isAuthenticated: status === 'authenticated',
      isLoading: status === 'loading',
      renderGoogleButton,
      signIn,
      signOut,
      status,
      user,
    }}>
      {children}
    </AuthContext>
  )
}
