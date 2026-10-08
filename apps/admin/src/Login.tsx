import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { api } from './api'
import { TopBar } from './TopBar'

export function Login({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!password) return setError('Enter the admin password.')
    setBusy(true)
    setError(null)
    try {
      await api.login(password)
      onSignedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <TopBar />
      <main className="login-wrap">
        <form className="card login" onSubmit={submit} noValidate>
          <img src="/logo.png" alt="VEXX" />
          <div>
            <h1 className="display">Sign in</h1>
            <p>Manage the VEXX About panel and roster in Discord.</p>
          </div>
          <label className="field">
            <span>Password</span>
            <div className="pw">
              <input
                className="input"
                type={shown ? 'text' : 'password'}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
              />
              {/* the icon shows the current state: an open eye means the password is readable now */}
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShown((s) => !s)}
                aria-label={shown ? 'Hide password' : 'Show password'}
                aria-pressed={shown}
              >
                {shown ? <Eye size={17} aria-hidden /> : <EyeOff size={17} aria-hidden />}
              </button>
            </div>
          </label>
          {error ? (
            <div className="notice bad" role="alert">
              {error}
            </div>
          ) : null}
          <button className="btn primary" type="submit" disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" aria-hidden /> : null}
            {busy ? 'Signing in' : 'Sign in'}
          </button>
        </form>
      </main>
    </>
  )
}
