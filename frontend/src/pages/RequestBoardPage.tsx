// PAGE-005 RequestBoardPage (COMP-040 + COMP-041 RequestListItem, REQ-046, DEC-011)
// 최신순 12개/페이지, 주소에 ?page=n. 비밀글은 제목 대신 "비밀글입니다"
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import EmptyState from '../components/common/EmptyState'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Pagination from '../components/common/Pagination'
import { KindBadge, StatusBadge } from '../components/request/RequestBadges'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatDate } from '../lib/format'
import { SECRET_TITLE } from '../lib/requestRules'
import { ApiError } from '../services/apiClient'
import { requestService } from '../services/requestService'
import type { Page } from '../types/api'
import type { RequestSummary } from '../types/request'

const PAGE_SIZE = 12

// COMP-041 RequestListItem
function RequestListItem({ item }: { item: RequestSummary }) {
  return (
    <Link to={`/requests/${item.id}`} className="block px-1 py-4 hover:bg-gray-50 md:px-3">
      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={item.kind} />
        <StatusBadge answered={item.answered} />
      </div>
      <p className={`mt-1.5 font-medium ${item.is_secret ? 'text-gray-500' : 'text-gray-900'}`}>
        {item.is_secret ? SECRET_TITLE : item.title}
      </p>
      <p className="mt-1 text-xs text-gray-500">
        {item.nickname} · <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
      </p>
    </Link>
  )
}

export default function RequestBoardPage() {
  useDocumentTitle('쥔장에게 묻기')
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [result, setResult] = useState<{ page: number; data: Page<RequestSummary> } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    requestService
      .list(page, PAGE_SIZE)
      .then((data) => {
        if (!active) return
        setResult({ page, data })
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '요청 목록을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [page])

  const data = result?.page === page ? result.data : null

  function goToPage(next: number) {
    setSearchParams(next > 1 ? { page: String(next) } : {})
    window.scrollTo?.({ top: 0 })
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">쥔장에게 묻기</h1>
          <p className="mt-2 text-gray-600">필요한 자료, 만들어 보고 싶은 DIY 등 무엇이든 남겨 주세요.</p>
        </div>
        <Link to="/requests/new" className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          요청 남기기
        </Link>
      </header>

      {error ? (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      ) : !data ? (
        <LoadingSpinner />
      ) : data.items.length === 0 ? (
        <EmptyState message="아직 요청이 없습니다. 첫 요청을 남겨 주세요!" />
      ) : (
        <>
          <ul aria-label="요청 목록" className="mt-6 divide-y divide-gray-100 border-y border-gray-100">
            {data.items.map((item) => (
              <li key={item.id}>
                <RequestListItem item={item} />
              </li>
            ))}
          </ul>
          <Pagination page={page} size={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </main>
  )
}
