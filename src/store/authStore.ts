import { create } from 'zustand'
import { apiLogin, apiRegister, type AuthUser } from '../api/client'
import { getToken, setToken, clearToken } from '../api/token'

interface AuthState {
  user: AuthUser | null
  token: string | null
  isAuthed: () => boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

// user is cached in localStorage alongside the token (token.ts owns the token).
const cachedUser = (() => {
  try { return JSON.parse(localStorage.getItem('pg_user') || 'null') as AuthUser | null } catch { return null }
})()

export const useAuthStore = create<AuthState>((set, get) => ({
  user: cachedUser,
  token: getToken(),
  isAuthed: () => !!get().token,

  login: async (email, password) => {
    const { token, user } = await apiLogin(email, password)
    setToken(token); localStorage.setItem('pg_user', JSON.stringify(user))
    set({ token, user })
  },
  register: async (email, password) => {
    const { token, user } = await apiRegister(email, password)
    setToken(token); localStorage.setItem('pg_user', JSON.stringify(user))
    set({ token, user })
  },
  logout: () => {
    clearToken(); localStorage.removeItem('pg_user')
    set({ token: null, user: null })
  },
}))
