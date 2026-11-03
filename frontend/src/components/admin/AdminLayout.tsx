// COMP-101 AdminLayout + COMP-102 AdminNav
// 메뉴는 기능이 구현되는 단계(M8 댓글)에 맞춰 추가한다.
import type { MouseEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { confirmLeave, setLeaveGuard } from '../../lib/leaveGuard'

const NAV_ITEMS = [
  { to: '/admin', label: '대시보드', end: true },
  { to: '/admin/categories', label: '카테고리', end: false },
  { to: '/admin/posts', label: '게시글', end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return `rounded px-3 py-2 text-sm ${isActive ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`
}

// 저장하지 않은 글이 있으면 메뉴 이동 전에 확인한다 (TC-ADM-008)
function guardNavigation(event: MouseEvent) {
  if (!confirmLeave()) event.preventDefault()
}

export default function AdminLayout() {
  const { username, logout } = useAdminAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    if (!confirmLeave()) return
    setLeaveGuard(null)
    await logout()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-3">
          <span className="mr-2 font-bold">SmallWorking 관리</span>
          <nav aria-label="관리자 메뉴" className="flex flex-wrap gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={navClass} onClick={guardNavigation}>
                {item.label}
              </NavLink>
            ))}
            <a href="/" onClick={guardNavigation} className="rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100">
              사이트 보기
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2 text-sm">
            {username && <span className="text-gray-500">{username}</span>}
            <button
              type="button"
              onClick={handleLogout}
              className="rounded border border-gray-300 px-3 py-1.5 hover:bg-gray-100"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
