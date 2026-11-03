import { useContext } from 'react'
import { AdminAuthContext, type AdminAuthValue } from './adminAuthContextValue'

export function useAdminAuth(): AdminAuthValue {
  const value = useContext(AdminAuthContext)
  if (!value) throw new Error('useAdminAuth는 AdminAuthProvider 안에서만 사용할 수 있습니다.')
  return value
}
