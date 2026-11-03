// PAGE-107 CommentManagementPage (COMP-140 + COMP-141 AdminCommentTable, REQ-035, DEC-005)
// 전체 댓글·답글 최신순 20개/페이지, 비밀번호 없이 삭제 (공개 화면과 같은 삭제 규칙)
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import { formatDateTime } from '../../lib/format'
import { ApiError } from '../../services/apiClient'
import { adminCommentService } from '../../services/commentService'
import type { Page } from '../../types/api'
import type { AdminComment } from '../../types/comment'

const PAGE_SIZE = 20

type Notice = { kind: 'success' | 'error'; text: string } | null

function deleteMessage(comment: AdminComment): string {
  if (comment.reply_count > 0) {
    return `'${comment.nickname}'님의 댓글을 삭제합니다. 답글 ${comment.reply_count}개는 유지되고 '삭제된 댓글입니다'로 표시됩니다.`
  }
  return `'${comment.nickname}'님의 ${comment.parent_comment_id ? '답글' : '댓글'}을 삭제합니다. 되돌릴 수 없습니다.`
}

export default function CommentManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const [data, setData] = useState<Page<AdminComment> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<AdminComment | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    let active = true
    adminCommentService
      .list(page, PAGE_SIZE)
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '댓글을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [page, reloadKey])

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await adminCommentService.remove(deleting.id)
      setNotice({ kind: 'success', text: '댓글을 삭제했습니다.' })
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
      <h1 className="text-xl font-bold">댓글 관리</h1>

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
        <p className="mt-8 text-center text-gray-500">아직 댓글이 없습니다.</p>
      ) : (
        <>
          <ul aria-label="댓글 목록" className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {data.items.map((comment) => (
              <li key={comment.id} className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500">
                    <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">
                      {comment.parent_comment_id ? '답글' : '댓글'}
                    </span>
                    <span className="font-medium text-gray-800">{comment.nickname}</span> · {formatDateTime(comment.created_at)}
                    {comment.reply_count > 0 && ` · 답글 ${comment.reply_count}`}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm text-gray-800">{comment.content}</p>
                  <Link to={`/posts/${comment.post_id}`} className="mt-1 inline-block text-xs text-blue-700 hover:underline">
                    {comment.post_title}
                  </Link>
                </div>
                <button
                  type="button"
                  aria-label={`${comment.nickname}의 ${comment.parent_comment_id ? '답글' : '댓글'} 삭제`}
                  onClick={() => setDeleting(comment)}
                  className="self-start rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            size={PAGE_SIZE}
            total={data.total}
            onChange={(p) => setSearchParams(p > 1 ? { page: String(p) } : {})}
          />
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="댓글 삭제"
          message={deleteMessage(deleting)}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
