// PAGE-108 RequestManagementPage (COMP-150 + COMP-151 AnswerEditor, REQ-049, DEC-011)
// 상태 탭(전체/접수/답변 완료), 최신순 20개/페이지, 비밀글 포함 전체 내용, 답변 작성·수정·삭제, 요청 삭제
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import LoadingSpinner from '../../components/common/LoadingSpinner'
import Pagination from '../../components/common/Pagination'
import { KindBadge, StatusBadge } from '../../components/request/RequestBadges'
import { formatDateTime } from '../../lib/format'
import { BODY, lengthOk } from '../../lib/requestRules'
import { ApiError } from '../../services/apiClient'
import { adminRequestService } from '../../services/requestService'
import type { AdminRequest, AdminRequestPage, RequestStatusFilter } from '../../types/request'

const PAGE_SIZE = 20

const TABS: { value: RequestStatusFilter | undefined; label: string }[] = [
  { value: undefined, label: '전체' },
  { value: 'open', label: '접수' },
  { value: 'answered', label: '답변 완료' },
]

type Notice = { kind: 'success' | 'error'; text: string } | null

function parseStatus(value: string | null): RequestStatusFilter | undefined {
  return value === 'open' || value === 'answered' ? value : undefined
}

// COMP-151 AnswerEditor
function AnswerEditor({
  item,
  onSaved,
  onNotice,
}: {
  item: AdminRequest
  onSaved: () => void
  onNotice: (notice: Notice) => void
}) {
  const id = useId()
  const [answer, setAnswer] = useState(item.answer ?? '')
  const [busy, setBusy] = useState(false)
  const length = answer.trim().length
  const changed = answer.trim() !== (item.answer ?? '')

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try {
      await action()
      onNotice({ kind: 'success', text: success })
      onSaved()
    } catch (err) {
      onNotice({ kind: 'error', text: err instanceof ApiError ? err.message : '처리하지 못했습니다.' })
    } finally {
      setBusy(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lengthOk(answer, BODY) || !changed || busy) return
    void run(() => adminRequestService.saveAnswer(item.id, answer.trim()), '답변을 저장했습니다.')
  }

  return (
    <form onSubmit={handleSubmit} aria-label={`요청 ${item.id} 답변`} className="mt-3 space-y-2">
      <label htmlFor={`${id}-answer`} className="text-sm font-medium">
        답변
      </label>
      <textarea
        id={`${id}-answer`}
        rows={3}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="답변을 입력하면 '답변 완료'로 바뀝니다."
        className="w-full resize-y rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center justify-end gap-2">
        <span className={`mr-auto text-xs ${length > BODY.max ? 'text-red-600' : 'text-gray-400'}`}>
          {length}/{BODY.max}
          {item.answered_at && ` · 마지막 답변 ${formatDateTime(item.answered_at)}`}
        </span>
        {item.answer !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(() => adminRequestService.deleteAnswer(item.id), '답변을 삭제했습니다.')}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            답변 삭제
          </button>
        )}
        <button
          type="submit"
          disabled={!lengthOk(answer, BODY) || !changed || busy}
          className="rounded bg-gray-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          답변 저장
        </button>
      </div>
    </form>
  )
}

export default function RequestManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const status = parseStatus(searchParams.get('status'))
  const [data, setData] = useState<AdminRequestPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [deleting, setDeleting] = useState<AdminRequest | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => {
    let active = true
    adminRequestService
      .list(status, page, PAGE_SIZE)
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '요청을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [status, page, reloadKey])

  const reload = () => setReloadKey((k) => k + 1)

  function changeTab(next: RequestStatusFilter | undefined) {
    setNotice(null)
    setSearchParams(next ? { status: next } : {})
  }

  function changePage(next: number) {
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (next > 1) params.page = String(next)
    setSearchParams(params)
  }

  async function handleDelete() {
    if (!deleting) return
    setBusy(true)
    try {
      await adminRequestService.remove(deleting.id)
      setNotice({ kind: 'success', text: '요청을 삭제했습니다.' })
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ApiError ? err.message : '삭제하지 못했습니다.' })
    } finally {
      setDeleting(null)
      setBusy(false)
      reload()
    }
  }

  return (
    <section>
      <h1 className="text-xl font-bold">요청 관리</h1>

      <div role="tablist" aria-label="요청 상태" className="mt-4 flex flex-wrap gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.label}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => changeTab(tab.value)}
            className={`rounded px-3 py-1.5 text-sm ${status === tab.value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
          >
            {tab.label}
            {tab.value === 'open' && data ? ` ${data.open_count}` : ''}
          </button>
        ))}
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
        <p className="mt-8 text-center text-gray-500">해당하는 요청이 없습니다.</p>
      ) : (
        <>
          <ul aria-label="요청 목록" className="mt-4 space-y-3">
            {data.items.map((item) => (
              <li key={item.id} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <KindBadge kind={item.kind} />
                  <StatusBadge answered={item.answer !== null} />
                  {item.is_secret && <span>🔒 비밀글</span>}
                  <span>
                    <span className="font-medium text-gray-800">{item.nickname}</span> · {formatDateTime(item.created_at)}
                  </span>
                </div>
                <div className="mt-2 flex items-start gap-3">
                  <Link to={`/requests/${item.id}`} className="min-w-0 flex-1 font-semibold hover:underline">
                    {item.title}
                  </Link>
                  <button
                    type="button"
                    aria-label={`요청 '${item.title}' 삭제`}
                    onClick={() => setDeleting(item)}
                    className="shrink-0 rounded border border-red-300 px-3 py-1 text-sm text-red-600"
                  >
                    삭제
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{item.content}</p>
                <AnswerEditor key={`${item.id}:${item.answered_at ?? ''}`} item={item} onSaved={reload} onNotice={setNotice} />
              </li>
            ))}
          </ul>
          <Pagination page={page} size={PAGE_SIZE} total={data.total} onChange={changePage} />
        </>
      )}

      {deleting && (
        <ConfirmDialog
          title="요청 삭제"
          message={`'${deleting.nickname}'님의 요청 '${deleting.title}'을(를) 삭제합니다. 답변도 함께 삭제되며 되돌릴 수 없습니다.`}
          busy={busy}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
