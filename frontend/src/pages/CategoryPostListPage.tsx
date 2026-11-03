// PAGE-002 CategoryPostListPage (COMP-020~023, REQ-023, DEC-006)
// 페이지 번호 방식, 12개/페이지, 주소에 ?page=n을 남긴다 (새로고침·공유·뒤로 가기, TC-POST-016)
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router'
import EmptyState from '../components/common/EmptyState'
import LoadingSpinner from '../components/common/LoadingSpinner'
import Pagination from '../components/common/Pagination'
import { usePublicContext } from '../components/layout/publicOutletContext'
import PostCard from '../components/post/PostCard'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { ApiError } from '../services/apiClient'
import { postService } from '../services/postService'
import type { Page } from '../types/api'
import type { PostSummary } from '../types/post'
import NotFoundPage from './NotFoundPage'

const PAGE_SIZE = 12

export default function CategoryPostListPage() {
  const { categoryId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const { categories, categoriesLoading } = usePublicContext()
  const category = categories.find((c) => String(c.id) === categoryId)
  useDocumentTitle(category?.name)

  const [result, setResult] = useState<{ key: string; data: Page<PostSummary> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestKey = `${categoryId}:${page}`

  useEffect(() => {
    if (!category) return
    let active = true
    postService
      .list({ category_id: category.id, page, size: PAGE_SIZE })
      .then((data) => {
        if (!active) return
        setResult({ key: `${category.id}:${page}`, data })
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '게시글을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [category, page])

  if (categoriesLoading) return <LoadingSpinner />
  if (!category) return <NotFoundPage />

  const data = result?.key === requestKey ? result.data : null

  function goToPage(next: number) {
    setSearchParams(next > 1 ? { page: String(next) } : {})
    window.scrollTo?.({ top: 0 })
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      {/* COMP-021 CategoryHeader */}
      <header>
        <h1 className="text-2xl font-bold">{category.name}</h1>
        {category.description && <p className="mt-2 text-gray-600">{category.description}</p>}
      </header>

      {error ? (
        <p role="alert" className="mt-6 text-red-600">
          {error}
        </p>
      ) : !data ? (
        <LoadingSpinner />
      ) : data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* COMP-022 PostList: Mobile 1열 / Tablet 2열 / Desktop 3열 */}
          <ul aria-label={`${category.name} 게시글`} className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((post) => (
              <li key={post.id}>
                <PostCard post={post} />
              </li>
            ))}
          </ul>
          <Pagination page={page} size={PAGE_SIZE} total={data.total} onChange={goToPage} />
        </>
      )}
    </main>
  )
}
