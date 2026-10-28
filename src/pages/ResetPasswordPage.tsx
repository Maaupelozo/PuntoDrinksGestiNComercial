import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../lib/errors'
import { Button } from '../components/ui/Button'
import { StatusMessage } from '../components/ui/StatusMessage'
import { validatePassword } from '../lib/settings-rules'

export function ResetPasswordPage() {
  const { session, loading, recovering, updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { validatePassword(password) } catch (failure) { setError(errorMessage(failure)); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      setSuccess(true)
      setPassword('')
      setConfirm('')
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-screen"><div className="panel auth-panel">
    <div className="auth-brand"><span>PD</span><div><b>PUNTO</b><small>DRINKS</small></div></div>
    <h1>Restablecer contraseña</h1>
    {loading ? <p>Cargando sesión…</p> : success ? <><StatusMessage tone="success" message="Contraseña actualizada. Iniciá sesión con la nueva contraseña."/><Link to="/ingresar" className="text-link">Ir al ingreso</Link></> : !session || !recovering ? <><StatusMessage message="El enlace no es válido o venció. Solicitá uno nuevo."/><Link to="/ingresar" className="text-link">Volver al ingreso</Link></> : <>
      {error && <StatusMessage message={error}/>}
      <form className="auth-form" onSubmit={submit}>
        <label className="field"><span>Nueva contraseña</span><div><input type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8}/></div></label>
        <label className="field"><span>Repetir contraseña</span><div><input type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} required minLength={8}/></div></label>
        <Button type="submit" className="confirm" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</Button>
      </form>
    </>}
  </div></div>
}
