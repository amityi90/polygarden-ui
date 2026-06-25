import { useEffect, useState } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { usePopupStore, type PopupConfig } from '../../store/popupStore'
import { AuthForm } from '../auth/AuthForm'

/**
 * The one shared popup, mounted once in Layout. Renders by `kind`:
 *  - login/register → blocking modal hosting the auth form
 *  - confirm        → blocking modal with Confirm/Cancel
 *  - info           → auto-dismissing toast (success/error/info)
 */
export function Popup() {
  const { current, closePopup } = usePopupStore()

  // Esc closes blocking modals
  useEffect(() => {
    if (!current || current.kind === 'info') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePopup() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, closePopup])

  // info toast auto-dismiss
  useEffect(() => {
    if (current?.kind !== 'info') return
    const id = setTimeout(closePopup, 3200)
    return () => clearTimeout(id)
  }, [current, closePopup])

  if (!current) return null

  // ── info toast ──────────────────────────────────────────────────────────────
  if (current.kind === 'info') {
    const variant = current.variant ?? 'info'
    const Icon = variant === 'success' ? CheckCircle2 : variant === 'error' ? AlertCircle : Info
    const color = variant === 'success' ? 'text-emerald-400' : variant === 'error' ? 'text-red-400' : 'text-sky-400'
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] animate-[fadeIn_.15s_ease-out]">
        <div className="flex items-center gap-2 rounded-xl bg-neutral-900/95 border border-neutral-700 px-4 py-2.5 shadow-xl backdrop-blur">
          <Icon className={`w-5 h-5 ${color}`} />
          <span className="text-sm text-neutral-100">{current.message}</span>
        </div>
      </div>
    )
  }

  // ── blocking modal (login / register / confirm) ──────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={closePopup}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-700 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={closePopup} className="absolute top-3 right-3 text-neutral-500 hover:text-neutral-200">
          <X className="w-5 h-5" />
        </button>

        {(current.kind === 'login' || current.kind === 'register') && <AuthForm mode={current.kind} />}

        {current.kind === 'prompt' && <PromptForm config={current} onClose={closePopup} />}

        {current.kind === 'confirm' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-neutral-100">{current.title ?? 'Are you sure?'}</h2>
            {current.message && <p className="text-sm text-neutral-400">{current.message}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={closePopup} className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
                Cancel
              </button>
              <button
                onClick={() => { current.onConfirm?.(); closePopup() }}
                className="rounded-lg bg-red-600 hover:bg-red-500 px-3 py-2 text-sm font-medium text-white"
              >
                {current.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** Styled text/date prompt — replaces window.prompt. */
function PromptForm({ config, onClose }: { config: PopupConfig; onClose: () => void }) {
  const [value, setValue] = useState(config.defaultValue ?? '')
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    config.onSubmit?.(v)
    onClose()
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-neutral-100">{config.title ?? 'Enter a value'}</h2>
      {config.label && <label className="text-xs text-neutral-400 -mb-2">{config.label}</label>}
      <input
        autoFocus
        type={config.inputType ?? 'text'}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
          Cancel
        </button>
        <button type="submit" className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-sm font-medium text-white">
          {config.submitLabel ?? 'OK'}
        </button>
      </div>
    </form>
  )
}
