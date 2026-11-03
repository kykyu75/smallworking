// COMP-100 RequireAdmin (REQ-042, TC-ADM-003, TC-ADM-018)
// - 관리자 화면 진입 시 로그인 상태를 확인하고, 아니면 /admin/login?redirect=<원래 주소>로 보낸다.
// - 작업 중 세션이 만료되면 화면을 바로 치우지 않고, 내용을 복사할 수 있게 안내한 뒤 로그인으로 보낸다.
import { useEffect, type ReactNode } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { setLeaveGuard } from '../../lib/leaveGuard'
import LoadingSpinner from '../common/LoadingSpinner'

function loginPath(pathname: string, search: string): string {
  return `/admin/login?redirect=${encodeURIComponent(pathname + search)}`
}

export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, check } = useAdminAuth()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (status === 'unknown') void check()
  }, [status, check])

  if (status === 'anonymous') return <Navigate to={loginPath(location.pathname, location.search)} replace />
  if (status !== 'authenticated' && status !== 'expired') return <LoadingSpinner label="로그인 상태를 확인하고 있습니다" />

  // 'authenticated'와 'expired'가 같은 구조를 쓴다: 배너 자리 + children.
  // children 위치가 바뀌면 React가 화면을 새로 만들어 작성 중인 글이 사라지므로 자리를 고정한다.
  return (
    <>
      {status === 'expired' && (
        <div
          role="alert"
          className="sticky top-0 z-40 flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <p className="flex-1">로그인이 만료되었습니다. 작성 중인 내용이 있으면 복사해 두고 다시 로그인해 주세요.</p>
          <button
            type="button"
            onClick={() => {
              setLeaveGuard(null) // 이미 안내했으므로 이동 확인 창은 띄우지 않는다
              navigate(loginPath(location.pathname, location.search))
            }}
            className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white"
          >
            다시 로그인
          </button>
        </div>
      )}
      {children}
    </>
  )
}
