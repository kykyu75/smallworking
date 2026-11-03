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

  // 어떤 API든 401이 오면 로그아웃 상태로 바꾼다 → RequireAdmin이 로그인 화면으로 보낸다
  useEffect(() => {
    setUnauthorizedHandler(() => markAnonymous())
    return () => setUnauthorizedHandler(null)
  }, [markAnonymous])

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
