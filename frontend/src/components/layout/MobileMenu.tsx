// COMP-004 MobileMenu — Mobile(767px 이하) 햄버거 + 드로어 (REQ-036, TC-RES-002)
import { useState } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { Category } from '../../types/category'

export default function MobileMenu({ categories }: { categories: Category[] }) {
  const location = useLocation()
  // 메뉴를 연 화면의 경로를 기억한다. 다른 화면으로 이동하면(로고 클릭 포함) 자동으로 닫힌 상태가 된다.
  const [openedAt, setOpenedAt] = useState<string | null>(null)
  const isOpen = openedAt === location.pathname

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="mobile-menu"
        onClick={() => setOpenedAt(isOpen ? null : location.pathname)}
        className="rounded p-2 text-gray-700 hover:bg-gray-100"
      >
        <span className="sr-only">{isOpen ? '메뉴 닫기' : '메뉴 열기'}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2}>
          {isOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
        </svg>
      </button>

      {isOpen && (
        <nav id="mobile-menu" aria-label="카테고리" className="absolute inset-x-0 top-full border-b border-gray-200 bg-white shadow">
          <ul className="flex flex-col px-4 py-2">
            {categories.map((category) => (
              <li key={category.id}>
                <NavLink
                  to={`/category/${category.id}`}
                  onClick={() => setOpenedAt(null)}
                  className="block py-3 text-gray-800"
                >
                  {category.name}
                </NavLink>
              </li>
            ))}
            {/* COMP-006 요청 게시판 (DEC-011) */}
            <li className="border-t border-gray-100">
              <NavLink to="/requests" onClick={() => setOpenedAt(null)} className="block py-3 text-gray-800">
                쥔장에게 묻기
              </NavLink>
            </li>
          </ul>
        </nav>
      )}
    </div>
  )
}
