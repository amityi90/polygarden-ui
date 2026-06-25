import { create } from 'zustand'

export type PopupKind = 'login' | 'register' | 'info' | 'confirm' | 'prompt'
export type InfoVariant = 'success' | 'error' | 'info'

export interface PopupConfig {
  kind: PopupKind
  // info
  variant?: InfoVariant
  message?: string
  // confirm
  title?: string
  onConfirm?: () => void
  confirmLabel?: string
  // prompt (styled text/date input)
  label?: string
  defaultValue?: string
  inputType?: 'text' | 'date'
  submitLabel?: string
  onSubmit?: (value: string) => void
}

interface PopupState {
  current: PopupConfig | null
  openPopup: (config: PopupConfig) => void
  closePopup: () => void
}

export const usePopupStore = create<PopupState>((set) => ({
  current: null,
  openPopup: (config) => set({ current: config }),
  closePopup: () => set({ current: null }),
}))

/** One-call helper for transient feedback ("Garden saved", "Login failed", …). */
export function notify(variant: InfoVariant, message: string) {
  usePopupStore.getState().openPopup({ kind: 'info', variant, message })
}
