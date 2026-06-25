import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usePopupStore } from '../../store/popupStore'

/** Gate a route behind auth: redirect home + open the login popup if not signed in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const authed = useAuthStore((s) => s.isAuthed())
  const openPopup = usePopupStore((s) => s.openPopup)

  useEffect(() => {
    if (!authed) openPopup({ kind: 'login' })
  }, [authed, openPopup])

  if (!authed) return <Navigate to="/" replace />
  return <>{children}</>
}
