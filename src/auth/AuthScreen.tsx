import { LogOut } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '../components/ui/Button'
import { useAuth } from './useAuth'

const lsaLogo = `${import.meta.env.BASE_URL}imgs/logos/LSA-Transperent- Black.png`

export function AuthLoadingScreen() {
  return (
    <main className="auth-screen-new">
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
    <main className="auth-screen-new">
      <div className="auth-container">
        <div className="auth-header">
          <img src={lsaLogo} alt="LSA" className="auth-header__logo" />
          <span className="auth-header__label">LSA CONNECT</span>
        </div>

        <div className="auth-welcome">
          <h1 className="auth-welcome__heading">Welcome back.</h1>
          <p className="auth-welcome__text">Sign in to access the LSA workspace.</p>
        </div>

        <div className="auth-card">
          <div className="auth-card__content">
            <p className="auth-card__label">Authorised staff access only</p>
            <div className="auth-google-button" ref={buttonRef} />
            <button className="auth-google-fallback" type="button" onClick={signIn}>
              Continue with Google
            </button>
            {error && <p className="auth-error" role="alert">{error}</p>}
          </div>
        </div>

        <footer className="auth-footer">
          <div className="auth-footer__content">
            <p className="auth-footer__credits">
              Built with <a href="https://hackunion.in" target="_blank" rel="noopener noreferrer">HackUnion</a> <span className="auth-footer__separator">·</span> Designed & Developed by <a href="https://abdulvasay.com" target="_blank" rel="noopener noreferrer">Abdul Vasay</a>
            </p>
            <p className="auth-footer__support">
              Need help? <a href="mailto:hello@abdulvasay.com">Contact support</a>
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}

export function AccessDeniedScreen() {
  const { email, signOut } = useAuth()
  return (
    <main className="auth-screen-new">
      <div className="auth-container">
        <div className="auth-header">
          <img src={lsaLogo} alt="LSA" className="auth-header__logo" />
          <span className="auth-header__label">LSA CONNECT</span>
        </div>

        <div className="auth-welcome">
          <h1 className="auth-welcome__heading">Account not authorised.</h1>
          <p className="auth-welcome__text">This Google account doesn't have access to LSA Connect.</p>
        </div>

        <div className="auth-card">
          <div className="auth-card__content">
            {email && (
              <div className="auth-card__account">
                <span>Signed in with</span>
                <strong>{email}</strong>
              </div>
            )}
            <Button onClick={signOut} className="auth-card__button">
              <LogOut aria-hidden="true" size={16} />
              Sign out / Try another account
            </Button>
            <p className="auth-card__support">Need access? Contact academy administration.</p>
          </div>
        </div>

        <footer className="auth-footer">
          <div className="auth-footer__content">
            <p className="auth-footer__credits">
              Built with <a href="https://hackunion.in" target="_blank" rel="noopener noreferrer">HackUnion</a> <span className="auth-footer__separator">·</span> Designed & Developed by <a href="https://abdulvasay.com" target="_blank" rel="noopener noreferrer">Abdul Vasay</a>
            </p>
            <p className="auth-footer__support">
              Need help? <a href="mailto:hello@abdulvasay.com">Contact support</a>
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
