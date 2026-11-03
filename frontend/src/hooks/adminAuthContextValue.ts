import { createContext } from 'react'
import type { LoginInput } from '../types/admin'

// expired: 로그인한 상태로 작업하다가 세션이 만료됨 (화면을 바로 치우지 않고 안내한다, TC-ADM-018)
export type AdminAuthStatus = 'unknown' | 'checking' | 'authenticated' | 'expired' | 'anonymous'

export interface AdminAuthValue {
  status: AdminAuthStatus
  username: string | null
  /** 서버에 로그인 상태를 확인한다 (API-025). */
  check: () => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

export const AdminAuthContext = createContext<AdminAuthValue | null>(null)
