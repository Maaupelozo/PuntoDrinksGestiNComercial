import { useState, type FormEvent } from 'react'
import { Button } from '../ui/Button'
import { StatusMessage } from '../ui/StatusMessage'
import { errorMessage } from '../../lib/errors'
import { validateSupplier } from '../../lib/procurement-rules'
import type { SupplierInput, SupplierRecord } from '../../types/procurement'

export function SupplierForm({ supplier, onSave, onCancel }: {
  supplier?: SupplierRecord
  onSave: (input: SupplierInput) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(supplier?.name ?? '')
  const [phone, setPhone] = useState(supplier?.phone ?? '')
  const [address, setAddress] = useState(supplier?.address ?? '')
  const [email, setEmail] = useState(supplier?.email ?? '')
  const [notes, setNotes] = useState(supplier?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    try {
      const input = validateSupplier({ name, phone, address, email, notes })
      setBusy(true)
      await onSave(input)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  return <form onSubmit={submit}>
    {error && <StatusMessage message={error}/>}
    <div className="form-grid">
      <label className="field"><span>Nombre</span><div><input required maxLength={160} value={name} onChange={event => setName(event.target.value)}/></div></label>
      <label className="field"><span>Teléfono</span><div><input required maxLength={80} type="tel" value={phone} onChange={event => setPhone(event.target.value)}/></div></label>
      <label className="field"><span>Dirección</span><div><input maxLength={300} value={address} onChange={event => setAddress(event.target.value)}/></div></label>
      <label className="field"><span>Correo electrónico</span><div><input type="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></div></label>
    </div>
    <label className="field"><span>Observaciones</span><textarea maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)}/></label>
    <div className="form-actions"><Button secondary onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={busy}>{busy ? 'Guardando…' : 'Guardar proveedor'}</Button></div>
  </form>
}
