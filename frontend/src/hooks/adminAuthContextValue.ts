import { createContext } from 'react'
import type { LoginInput } from '../types/admin'

export type AdminAuthStatus = 'unknown' | 'checking' | 'authenticated' | 'anonymous'

export interface AdminAuthValue {
  status: AdminAuthStatus
  username: string | null
  /** 서버에 로그인 상태를 확인한다 (API-025). */
  check: () => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null)
