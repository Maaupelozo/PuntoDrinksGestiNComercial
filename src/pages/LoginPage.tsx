import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { StatusMessage } from '../components/ui/StatusMessage'

export function LoginPage() {
  const { session, loading, error: sessionError, recovering, signIn, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<'login' | 'forgot'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  if (loading) return <div className="auth-screen"><div className="panel auth-panel">Cargando sesión…</div></div>
  if (session && !recovering) return <Navigate to="/" replace/>
  if (session && recovering) return <Navigate to="/restablecer-clave" replace/>

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      if (mode === 'login') await signIn(email.trim(), password)
      else {
        await requestPasswordReset(email.trim())
        setMessage('Si existe una cuenta con ese correo, recibirás un enlace para restablecer la contraseña.')
      }
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-screen"><div className="panel auth-panel">
    <div className="auth-brand"><span>PD</span><div><b>PUNTO</b><small>DRINKS</small></div></div>
    <h1>{mode === 'login' ? 'Ingresar' : 'Recuperar contraseña'}</h1>
    <p>Gestión comercial de Punto Drinks</p>
    {sessionError && <StatusMessage message={sessionError}/>}
    {error && <StatusMessage message={error}/>}
    {message && <StatusMessage tone="success" message={message}/>}
    <form onSubmit={submit} className="auth-form">
      <label className="field"><span>Correo electrónico</span><div><input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></div></label>
      {mode === 'login' && <label className="field"><span>Contraseña</span><div><input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></div></label>}
      <Button className="confirm" disabled={busy || Boolean(sessionError)} type="submit">{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Enviar enlace'}</Button>
    </form>
    <button type="button" className="text-link auth-link" onClick={() => { setMode(mode === 'login' ? 'forgot' : 'login'); setError(null); setMessage(null) }}>
      {mode === 'login' ? 'Olvidé mi contraseña' : 'Volver al ingreso'}
    </button>
  </div></div>
}
