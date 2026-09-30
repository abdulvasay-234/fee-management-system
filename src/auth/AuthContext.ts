import { createContext } from 'react'

export interface AuthUser {
  email: string
  googleSub: string
  name?: string
  picture?: string
}

export type AuthStatus = 'accessDenied' | 'authenticated' | 'loading' | 'unauthenticated'

export interface AuthContextValue {
  email: string | null
  error: string
  idToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  renderGoogleButton: (element: HTMLElement) => void
  signIn: () => void
  signOut: () => void
  status: AuthStatus
  user: AuthUser | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
