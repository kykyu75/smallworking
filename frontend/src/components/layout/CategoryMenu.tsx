// COMP-003 CategoryMenu — Tablet/Desktop 가로 메뉴 (REQ-008, REQ-013)
import { NavLink } from 'react-router'
import type { Category } from '../../types/category'

function linkClass({ isActive }: { isActive: boolean }) {
  return `rounded px-3 py-2 text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-600 hover:text-gray-900'}`
}

export default function CategoryMenu({ categories }: { categories: Category[] }) {
  return (
    <nav aria-label="카테고리" className="hidden md:block">
      <ul className="flex flex-wrap gap-1">
        {categories.map((category) => (
          <li key={category.id}>
            <NavLink to={`/category/${category.id}`} className={linkClass}>
              {category.name}
            </NavLink>
          </li>
        ))}
        {/* COMP-006 요청 게시판 (DEC-011) — 카테고리 뒤 고정 메뉴 */}
        <li>
          <NavLink to="/requests" className={linkClass}>
            쥔장에게 묻기
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
