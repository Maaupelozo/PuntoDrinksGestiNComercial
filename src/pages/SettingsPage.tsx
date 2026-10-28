import { useEffect, useState, type FormEvent } from 'react'
import { Module } from '../components/ui/Module'
import { Icon } from '../components/ui/Icon'
import { PanelTitle } from '../components/ui/PanelTitle'
import { Button } from '../components/ui/Button'
import { LoadingRows } from '../components/ui/LoadingRows'
import { StatusMessage } from '../components/ui/StatusMessage'
import { useAuth } from '../context/AuthContext'
import { useBusinessSettings } from '../context/BusinessSettingsContext'
import { errorMessage } from '../lib/errors'
import { validatePassword } from '../lib/settings-rules'

type Tab = 'business' | 'profile' | 'preferences' | 'security' | 'users'
const tabs: [Tab, string][] = [
  ['business', 'Información del negocio'], ['profile', 'Perfil de usuario'],
  ['preferences', 'Preferencias'], ['security', 'Seguridad'], ['users', 'Usuarios y acceso'],
]

export function SettingsPage() {
  const { session, updateProfileName, requestEmailChange, changePassword, signOut } = useAuth()
  const { settings, loading, error: settingsError, save } = useBusinessSettings()
  const [tab, setTab] = useState<Tab>('business')
  const [name, setName] = useState(settings.business_name)
  const [phone, setPhone] = useState(settings.phone ?? '')
  const [address, setAddress] = useState(settings.address ?? '')
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '')
  const [minStock, setMinStock] = useState(String(settings.default_min_stock))
  const [profileName, setProfileName] = useState(String(session?.user.user_metadata.display_name ?? ''))
  const [email, setEmail] = useState(session?.user.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    setName(settings.business_name); setPhone(settings.phone ?? '')
    setAddress(settings.address ?? ''); setLogoUrl(settings.logo_url ?? '')
    setMinStock(String(settings.default_min_stock))
  }, [settings])
  useEffect(() => {
    setProfileName(String(session?.user.user_metadata.display_name ?? ''))
    setEmail(session?.user.email ?? '')
  }, [session?.user.user_metadata.display_name, session?.user.email])

  async function act(work: () => Promise<void>, message: string) {
    if (busy) return
    setBusy(true); setActionError(null); setNotice(null)
    try { await work(); if (message) setNotice(message) }
    catch (failure) { setActionError(errorMessage(failure)) }
    finally { setBusy(false) }
  }
  function switchTab(next: Tab) { setTab(next); setActionError(null); setNotice(null) }
  function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void act(() => save({ business_name: name, phone, address, logo_url: logoUrl,
      default_min_stock: settings.default_min_stock }), 'Datos del negocio guardados.')
  }
  function savePreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void act(() => save({ business_name: settings.business_name, phone: settings.phone,
      address: settings.address, logo_url: settings.logo_url,
      default_min_stock: Number(minStock) }), 'Stock mínimo predeterminado guardado.')
  }
  function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void act(() => updateProfileName(profileName), 'Nombre de perfil actualizado.')
  }
  function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (email.trim().toLowerCase() === session?.user.email?.toLowerCase()) return
    void act(() => requestEmailChange(email),
      'Solicitamos el cambio de correo. Confirmalo desde el enlace recibido antes de usar la dirección nueva.')
  }
  function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try { validatePassword(newPassword) }
    catch (failure) { setActionError(errorMessage(failure)); return }
    if (newPassword !== confirmPassword) { setActionError('Las contraseñas no coinciden.'); return }
    void act(async () => {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('')
    }, 'Contraseña actualizada.')
  }

  return <Module title="Configuración" subtitle="Negocio, perfil y seguridad">
    {settingsError && <StatusMessage message={settingsError}/>}
    <div className="settings-grid">
      <aside className="settings-nav" aria-label="Secciones de configuración">
        {tabs.map(([key, label]) => <button type="button" className={tab === key ? 'active' : ''}
          key={key} onClick={() => switchTab(key)} aria-current={tab === key ? 'page' : undefined}>
          {label}<Icon name="chevron" size={15}/>
        </button>)}
      </aside>
      <section className="panel settings-form">
        {loading ? <LoadingRows/> : <>
          {actionError && <StatusMessage message={actionError}/>}
          {notice && <StatusMessage tone="success" message={notice}/>}
          {tab === 'business' && <form onSubmit={saveBusiness}>
            <PanelTitle title="Información del negocio" subtitle="Datos guardados en Supabase"/>
            <div className="form-grid">
              <label className="field"><span>Nombre comercial</span><div><input required maxLength={160} value={name} onChange={event => setName(event.target.value)}/></div></label>
              <label className="field"><span>Teléfono</span><div><input type="tel" maxLength={50} value={phone} onChange={event => setPhone(event.target.value)}/></div></label>
              <label className="field"><span>Dirección (opcional)</span><div><input maxLength={300} value={address} onChange={event => setAddress(event.target.value)}/></div></label>
              <label className="field"><span>URL HTTPS del logo (opcional)</span><div><input type="url" value={logoUrl} onChange={event => setLogoUrl(event.target.value)} placeholder="https://…"/></div></label>
              <label className="field"><span>Moneda</span><div><input value="ARS — Peso argentino" readOnly/></div></label>
              <label className="field"><span>Zona horaria</span><div><input value="America/Argentina/Cordoba" readOnly/></div></label>
            </div>
            <p className="settings-info">{logoUrl ? 'El logo se mostrará en la navegación.' : 'Se utiliza el emblema PD hasta agregar un logo.'}</p>
            <div className="form-footer"><Button secondary onClick={() => { setName(settings.business_name); setPhone(settings.phone ?? ''); setAddress(settings.address ?? ''); setLogoUrl(settings.logo_url ?? '') }}>Cancelar</Button><Button type="submit" disabled={busy}>Guardar cambios</Button></div>
          </form>}
          {tab === 'profile' && <>
            <form onSubmit={saveProfile}><PanelTitle title="Perfil de usuario" subtitle="Tu nombre visible en la aplicación"/>
              <div className="form-grid"><label className="field"><span>Nombre</span><div><input required maxLength={120} value={profileName} onChange={event => setProfileName(event.target.value)}/></div></label>
                <label className="field"><span>Correo actual</span><div><input value={session?.user.email ?? ''} readOnly/></div></label></div>
              <div className="form-footer"><Button type="submit" disabled={busy}>Guardar perfil</Button></div></form>
            <form onSubmit={changeEmail}><h3 className="settings-subtitle">Cambiar correo electrónico</h3>
              <p className="settings-info">Supabase enviará un enlace de confirmación. El correo actual seguirá activo hasta completar el cambio.</p>
              <label className="field"><span>Nuevo correo</span><div><input type="email" required value={email} onChange={event => setEmail(event.target.value)}/></div></label>
              <div className="form-footer"><Button type="submit" disabled={busy || email.trim().toLowerCase() === session?.user.email?.toLowerCase()}>Solicitar cambio</Button></div></form>
          </>}
          {tab === 'preferences' && <form onSubmit={savePreference}>
            <PanelTitle title="Preferencias" subtitle="Valores usados al crear productos"/>
            <label className="field"><span>Stock mínimo predeterminado</span><div><input type="number" min="0" max="1000000" step="1" required value={minStock} onChange={event => setMinStock(event.target.value)}/></div></label>
            <p className="settings-info">Se propone al registrar un producto nuevo; cada producto conserva su propio mínimo y puede cambiarse antes de guardarlo.</p>
            <div className="form-footer"><Button type="submit" disabled={busy}>Guardar preferencia</Button></div>
          </form>}
          {tab === 'security' && <>
            <form onSubmit={savePassword}><PanelTitle title="Seguridad" subtitle="Cambiá tu contraseña con la contraseña actual"/>
              <div className="form-grid">
                <label className="field"><span>Contraseña actual</span><div><input type="password" autoComplete="current-password" required value={currentPassword} onChange={event => setCurrentPassword(event.target.value)}/></div></label>
                <label className="field"><span>Nueva contraseña</span><div><input type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={newPassword} onChange={event => setNewPassword(event.target.value)}/></div></label>
                <label className="field"><span>Repetir contraseña</span><div><input type="password" autoComplete="new-password" required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)}/></div></label>
              </div><div className="form-footer"><Button type="submit" disabled={busy}>Cambiar contraseña</Button></div></form>
            <div className="settings-section"><h3>Cerrar sesión</h3><p>Terminá la sesión en este dispositivo cuando dejes de usar Punto Drinks.</p><Button secondary onClick={() => void act(signOut, '')}>Cerrar sesión</Button></div>
          </>}
          {tab === 'users' && <><PanelTitle title="Usuarios y acceso" subtitle="Administración de cuentas"/>
            <p className="settings-info">Esta aplicación está preparada para un administrador. Las cuentas autorizadas se crean en Supabase Authentication → Users. No compartas la misma cuenta entre personas.</p>
            <div className="detail-grid"><div><span>Tu correo</span><b>{session?.user.email}</b></div><div><span>Identidad</span><b>{profileName || 'Administrador'}</b></div></div>
            <p className="settings-info">Antes de incorporar más usuarios, definí permisos y propiedad de datos para cada persona. El registro público debe permanecer deshabilitado.</p>
          </>}
        </>}
      </section>
    </div>
  </Module>
}
