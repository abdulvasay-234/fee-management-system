import { LogOut, ShieldCheck } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../components/ui/Button'
import { useAuth } from './useAuth'

const lsaLogo = `${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent- Black.png`

export function AuthLoadingScreen() {
  return (
    <main className="auth-screen">
      <div className="auth-loading" role="status">
        <img src={lsaLogo} alt="LSA" className="auth-loading__logo" />
        <span className="auth-loading__mark" aria-hidden="true" />
        <strong>Checking application access</strong>
        <p>Preparing LSA workspace.</p>
      </div>
    </main>
  )
}

export function LoginScreen() {
  const { error, renderGoogleButton, signIn } = useAuth()
  const buttonRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (buttonRef.current) renderGoogleButton(buttonRef.current)
  }, [renderGoogleButton])

  return (
    <main className="auth-screen">
      <aside className="auth-brand" aria-label="LSA">
        <img src={lsaLogo} alt="LSA" />
        <div>
          <span><a href="https://hackunion.in" target="_blank" rel="noopener noreferrer">Application supported by HackUnion</a></span>
          <h1>Fee Management</h1>
        </div>
      </aside>
      <section className="auth-content" aria-labelledby="login-title">
        <div className="auth-panel">
          <div className="auth-panel__icon" aria-hidden="true"><ShieldCheck size={24} /></div>
          <span className="auth-panel__eyebrow">Staff access only</span>
          <h2 id="login-title">Continue to workspace</h2>
          <p>Sign in with your approved Google account to continue.</p>
          <div className="auth-google-button" ref={buttonRef} />
          <button className="auth-google-fallback" type="button" onClick={signIn}>Try Google Sign-In</button>
          {error && <p className="auth-message" role="alert">{error}</p>}
          <small>Design & Developed by <a href="https://abdulvasay.com" target="_blank" rel="noopener noreferrer">Abdul Vasay</a></small>
          <small style={{ marginTop: '12px', display: 'block', fontSize: '0.75rem', color: '#666' }}>Need help? Email us at <a href="mailto:hello@abdulvasay.com">hello@abdulvasay.com</a></small>
        </div>
      </section>
    </main>
  )
}

export function AccessDeniedScreen() {
  const { email, signOut } = useAuth()
  return (
    <main className="auth-screen">
      <aside className="auth-brand" aria-label="LSA">
        <img src={lsaLogo} alt="LSA" />
        <div><span><a href="https://hackunion.in" target="_blank" rel="noopener noreferrer">Application supported by HackUnion</a></span><h1>Fee Management</h1></div>
      </aside>
      <section className="auth-content" aria-labelledby="access-denied-title">
        <div className="auth-panel">
          <div className="auth-panel__icon auth-panel__icon--denied" aria-hidden="true"><LogOut size={24} /></div>
          <span className="auth-panel__eyebrow">Access denied</span>
          <h2 id="access-denied-title">This account is not approved</h2>
          <p>Your Google account is not authorized to access this application.</p>
          {email && <div className="auth-account"><span>Signed in as</span><strong>{email}</strong></div>}
          <Button onClick={signOut}><LogOut aria-hidden="true" size={16} />Sign out / Try another account</Button>
          <small>Design & Developed by <a href="https://abdulvasay.com" target="_blank" rel="noopener noreferrer">Abdul Vasay</a></small>
          <small style={{ marginTop: '12px', display: 'block', fontSize: '0.75rem', color: '#666' }}>Need help? Email us at <a href="mailto:hello@abdulvasay.com">hello@abdulvasay.com</a></small>
        </div>
      </section>
    </main>
  )
}
