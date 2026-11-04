// PAGE-102 AdminDashboardPage — 관리 메뉴 바로가기 (COMPONENT_SPEC §9.2)
// + 답변하지 않은 요청 수 "새 요청 N건" (DEC-011, API-035 open_count)
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { adminRequestService } from '../../services/requestService'

const SHORTCUTS = [
  { to: '/admin/posts/new', label: '새 글 쓰기', description: '본문 중간에 사진을 넣어 글 작성' },
  { to: '/admin/posts', label: '게시글 관리', description: '목록·수정·삭제' },
  { to: '/admin/categories', label: '카테고리 관리', description: '추가·수정·삭제·순서 변경' },
  { to: '/admin/comments', label: '댓글 관리', description: '부적절한 댓글 삭제' },
]

export default function AdminDashboardPage() {
  const [openCount, setOpenCount] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    adminRequestService
      .list('open', 1, 1)
      .then((result) => {
        if (active) setOpenCount(result.open_count)
      })
      .catch(() => {
        // 개수를 못 불러와도 대시보드는 그대로 쓴다
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <section>
      <h1 className="text-xl font-bold">대시보드</h1>
      <ul className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <li>
          <Link
            to={openCount ? '/admin/requests?status=open' : '/admin/requests'}
            className={`block rounded-lg border bg-white p-4 hover:border-gray-400 ${openCount ? 'border-amber-300' : 'border-gray-200'}`}
          >
            <p className="font-medium">
              요청 관리
              {openCount !== null && (
                <span className={`ml-2 rounded px-1.5 py-0.5 text-xs ${openCount ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
                  새 요청 {openCount}건
                </span>
              )}
            </p>
            <p className="mt-1 text-sm text-gray-500">방문자 요청 확인·답변</p>
          </Link>
        </li>
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
