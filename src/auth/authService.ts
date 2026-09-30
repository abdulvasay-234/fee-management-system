export type AuthFailure = 'accessDenied' | 'sessionExpired'

type AuthFailureHandler = (failure: AuthFailure) => void

let idToken: string | null = null
let authFailureHandler: AuthFailureHandler | null = null

export function getIdToken() {
  return idToken
}

export function setIdToken(token: string) {
  idToken = token
}

export function clearIdToken() {
  idToken = null
}

export function setAuthFailureHandler(handler: AuthFailureHandler | null) {
  authFailureHandler = handler
  return () => {
    if (authFailureHandler === handler) authFailureHandler = null
  }
}

export function notifyAuthFailure(failure: AuthFailure, failedToken: string) {
  if (idToken !== failedToken) return
  clearIdToken()
  authFailureHandler?.(failure)
}
