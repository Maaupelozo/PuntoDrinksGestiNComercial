import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../context/AuthContext'

export function RequireSession() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="auth-screen"><div className="panel auth-panel">Cargando sesión…</div></div>
  if (!session) return <Navigate to="/ingresar" state={{ from: location.pathname }} replace/>
  return <Outlet/>
}
