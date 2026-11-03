// PAGE-102 AdminDashboardPage — 관리 메뉴 바로가기 (COMPONENT_SPEC §9.2)
// 바로가기는 각 기능이 구현되는 단계에서 추가한다.
import { Link } from 'react-router'

const SHORTCUTS = [{ to: '/admin/categories', label: '카테고리 관리', description: '추가·수정·삭제·순서 변경' }]

export default function AdminDashboardPage() {
  return (
    <section>
      <h1 className="text-xl font-bold">대시보드</h1>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block rounded-lg border border-gray-200 bg-white p-4 hover:border-gray-400">
              <p className="font-medium">{item.label}</p>
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
