// 관리자 로그인 상태 (COMPONENT_SPEC v1.0 §13: 전역 상태는 관리자 로그인 상태만 Context로 관리)
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { setUnauthorizedHandler } from '../services/apiClient'
import { adminAuthService } from '../services/adminAuthService'
import type { LoginInput } from '../types/admin'
import { AdminAuthContext, type AdminAuthStatus } from './adminAuthContextValue'

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminAuthStatus>('unknown')
  const [username, setUsername] = useState<string | null>(null)

  const markAnonymous = useCallback(() => {
    setStatus('anonymous')
    setUsername(null)
  }, [])

  // 작업 중 API가 401을 돌려주면 '만료' 상태로 바꾼다.
  // RequireAdmin은 화면(작성 중인 글)을 바로 치우지 않고 안내 배너를 띄운다 (TC-ADM-018).
  useEffect(() => {
    setUnauthorizedHandler(() => setStatus((prev) => (prev === 'authenticated' || prev === 'expired' ? 'expired' : 'anonymous')))
    return () => setUnauthorizedHandler(null)
  }, [])

  const check = useCallback(async () => {
    setStatus('checking')
    try {
      const me = await adminAuthService.me()
      setUsername(me.username)
      setStatus('authenticated')
    } catch {
      // 401이면 미로그인. 네트워크 오류 등도 로그인 화면에서 다시 시도하게 한다
      markAnonymous()
    }
  }, [markAnonymous])

  const login = useCallback(async (input: LoginInput) => {
    const me = await adminAuthService.login(input)
    setUsername(me.username)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await adminAuthService.logout()
    } finally {
      markAnonymous()
    }
  }, [markAnonymous])

  const value = useMemo(
    () => ({ status, username, check, login, logout }),
    [status, username, check, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}
