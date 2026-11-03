// COMP-100 RequireAdmin (REQ-042, TC-ADM-003)
// 관리자 화면 진입 시 로그인 상태를 확인하고, 아니면 /admin/login?redirect=<원래 주소>로 보낸다.
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import LoadingSpinner from '../common/LoadingSpinner'

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, check } = useAdminAuth()
  const location = useLocation()

  useEffect(() => {
    if (status === 'unknown') void check()
  }, [status, check])

  if (status === 'anonymous') {
    const redirect = location.pathname + location.search
    return <Navigate to={`/admin/login?redirect=${encodeURIComponent(redirect)}`} replace />
  }
  if (status !== 'authenticated') return <LoadingSpinner label="로그인 상태를 확인하고 있습니다" />
  return <>{children}</>
}
