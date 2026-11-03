// PAGE-104 PostManagementPage (COMP-120 + COMP-121 AdminPostTable, REQ-017, REQ-033)
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import { useCategories } from '../../hooks/useCategories'
import { formatDate } from '../../lib/format'
import { ApiError } from '../../services/apiClient'
import { postService } from '../../services/postService'
import type { Page } from '../../types/api'
import type { PostSummary } from '../../types/post'

const PAGE_SIZE = 20 // 관리자 목록 (DEC-006)

type Notice = { kind: 'success' | 'error'; text: string } | null

export default function PostManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const categoryParam = searchParams.get('category_id')
  const categoryId = categoryParam ? Number(categoryParam) : undefined

  const { categories } = useCategories()
  const [data, setData] = useState<Page<PostSummary> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<PostSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(() => {
    const text = (location.state as { notice?: string } | null)?.notice
    return text ? { kind: 'success', text } : null
  })

  useEffect(() => {
    let active = true
    postService
      .list({ page, size: PAGE_SIZE, category_id: categoryId })
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '게시글을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [page, categoryId, reloadKey])

  function changeQuery(next: { page?: number; category_id?: number | undefined }) {
    const params = new URLSearchParams()
    const nextCategory = 'category_id' in next ? next.category_id : categoryId
    if (nextCategory) params.set('category_id', String(nextCategory))
    const nextPage = next.page ?? 1
    if (nextPage > 1) params.set('page', String(nextPage))
    setSearchParams(params)
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await postService.remove(deleting.id)
      setNotice({ kind: 'success', text: `'${deleting.title}' 글을 삭제했습니다.` })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : '삭제하지 못했습니다.' })
    } finally {
      setDeleting(null)
      setBusy(false)
      setReloadKey((k) => k + 1)
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">게시글 관리</h1>
        <Link to="/admin/posts/new" className="ml-auto rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">
          새 글 쓰기
        </Link>
      </div>

      <div className="mt-4">
        <label htmlFor="post-filter" className="mr-2 text-sm text-gray-600">
          카테고리
        </label>
        <select
          id="post-filter"
          value={categoryId ?? ''}
          onChange={(e) => changeQuery({ category_id: e.target.value ? Number(e.target.value) : undefined })}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">전체</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mt-4 rounded px-3 py-2 text-sm ${notice.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}
        >
          {notice.text}
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-red-600">
          {error}
        </p>
      ) : !data ? (
        <LoadingSpinner />
      ) : data.items.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">아직 글이 없습니다.</p>
      ) : (
        <>
          {/* COMP-121: Mobile은 카드, Tablet 이상은 표처럼 한 줄 (TC-RES-009) */}
          <ul aria-label="게시글 목록" className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {data.items.map((post) => (
              <li key={post.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{post.title}</p>
                  <p className="text-xs text-gray-500">
                    {post.category_name} · {formatDate(post.created_at)} · 좋아요 {post.like_count} · 댓글 {post.comment_count}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to={`/posts/${post.id}`} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                    보기
                  </Link>
                  <Link to={`/admin/posts/${post.id}/edit`} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
                    수정
                  </Link>
                  <button
                    type="button"
                    aria-label={`${post.title} 삭제`}
                    onClick={() => setDeleting(post)}
                    className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} size={PAGE_SIZE} total={data.total} onChange={(p) => changeQuery({ page: p })} />
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="게시글 삭제"
          message={`'${deleting.title}' 글과 사진, 댓글, 좋아요가 모두 삭제됩니다. 되돌릴 수 없습니다.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
