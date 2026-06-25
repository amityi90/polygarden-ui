import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { usePopupStore, notify } from '../../store/popupStore'

/** Login / register form rendered inside the shared Popup. */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuthStore()
  const { openPopup, closePopup } = usePopupStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const isRegister = mode === 'register'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null); setBusy(true)
    try {
      if (isRegister) await register(email.trim(), password)
      else await login(email.trim(), password)
      closePopup()
      notify('success', isRegister ? 'Account created — welcome!' : 'Logged in')
    } catch (e) {
      const msg = (e as Error).message.replace(/^API error \d+: /, '')
      let parsed = msg
      try { parsed = JSON.parse(msg).error ?? msg } catch { /* keep */ }
      setErr(parsed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 w-full">
      <h2 className="text-lg font-semibold text-emerald-100">
        {isRegister ? 'Create your account' : 'Welcome back'}
      </h2>
      <input
        type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
        placeholder="Email" autoComplete="email"
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
      />
      <input
        type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder={isRegister ? 'Password (min 6 chars)' : 'Password'} autoComplete={isRegister ? 'new-password' : 'current-password'}
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <button
        type="submit" disabled={busy}
        className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-sm font-medium text-white"
      >
        {busy ? 'Please wait…' : isRegister ? 'Sign up' : 'Log in'}
      </button>
      <button
        type="button" onClick={() => openPopup({ kind: isRegister ? 'login' : 'register' })}
        className="text-xs text-emerald-400 hover:underline"
      >
        {isRegister ? 'Already have an account? Log in' : "No account? Sign up"}
      </button>
    </form>
  )
}
