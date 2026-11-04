// PAGE-007 RequestDetailPage (COMP-043 + COMP-044 SecretUnlockForm + COMP-045 RequestAnswer, REQ-047, REQ-048, DEC-011)
// | 상태 | 표시 |
// | 비밀글, 확인 전(locked) | 닉네임·날짜·상태 + 비밀번호 입력란 |
// | 열림 | 제목·내용·답변 + [수정][삭제] (답변이 있으면 수정 불가 안내) |
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import PasswordDialog from '../components/comment/PasswordDialog'
import LoadingSpinner from '../components/common/LoadingSpinner'
import RequestAnswer from '../components/request/RequestAnswer'
import { KindBadge, StatusBadge } from '../components/request/RequestBadges'
import RequestForm from '../components/request/RequestForm'
import SecretUnlockForm from '../components/request/SecretUnlockForm'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatDateTime } from '../lib/format'
import { SECRET_TITLE } from '../lib/requestRules'
import { ApiError } from '../services/apiClient'
import { requestService } from '../services/requestService'
import type { RequestDetail, RequestInput } from '../types/request'
import NotFoundPage from './NotFoundPage'

type State =
  | { status: 'loading' }
  | { status: 'ok'; detail: RequestDetail }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

function createdFromState(state: unknown, id: number): RequestDetail | null {
  const detail = (state as { detail?: RequestDetail } | null)?.detail
  return detail && detail.id === id ? detail : null
}

export default function RequestDetailPage() {
  const { requestId } = useParams()
  const id = Number(requestId)
  const location = useLocation()
  const navigate = useNavigate()
  // 방금 작성한 글이면 작성 응답을 그대로 쓴다 (비밀번호를 다시 묻지 않음)
  const [state, setState] = useState<{ id: number; value: State }>(() => {
    const created = createdFromState(location.state, id)
    return { id, value: created ? { status: 'ok', detail: created } : { status: 'loading' } }
  })
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const current: State = state.id === id ? state.value : { status: 'loading' }
  const needsFetch = current.status === 'loading'

  const detail = current.status === 'ok' ? current.detail : null
  useDocumentTitle(detail ? (detail.locked ? '비밀글' : detail.title) : null)

  useEffect(() => {
    if (!needsFetch) return
    if (!Number.isInteger(id) || id <= 0) {
      Promise.resolve().then(() => setState({ id, value: { status: 'not-found' } }))
      return
    }
    let active = true
    requestService
      .get(id)
      .then((data) => {
        if (active) setState({ id, value: { status: 'ok', detail: data } })
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
          setState({ id, value: { status: 'not-found' } })
        } else {
          const message = err instanceof ApiError ? err.message : '요청을 불러오지 못했습니다.'
          setState({ id, value: { status: 'error', message } })
        }
      })
    return () => {
      active = false
    }
  }, [id, needsFetch])

  if (current.status === 'loading') return <LoadingSpinner />
  if (current.status === 'not-found') return <NotFoundPage />
  if (current.status === 'error') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="alert" className="text-red-600">
          {current.message}
        </p>
      </main>
    )
  }

  const item = current.detail
  const show = (next: RequestDetail) => setState({ id, value: { status: 'ok', detail: next } })

  async function unlock(password: string) {
    show(await requestService.open(id, password))
  }

  async function save(input: RequestInput) {
    show(await requestService.update(id, input))
    setEditing(false)
  }

  async function remove(password: string) {
    await requestService.remove(id, password) // 틀리면 예외 → 창이 안내를 띄운다
    navigate('/requests', { replace: true })
  }

  const edited = item.updated_at !== item.created_at
  const answered = item.answer !== null

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/requests" className="text-sm text-gray-500 hover:text-gray-900">
        ← 요청 목록
      </Link>

      <article className="mt-3">
        <header className="border-b border-gray-200 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <KindBadge kind={item.kind} />
            {!item.locked && <StatusBadge answered={answered} />}
            {item.is_secret && <span className="text-xs text-gray-500">🔒 비밀글</span>}
          </div>
          <h1 className={`mt-2 text-2xl font-bold leading-snug ${item.locked ? 'text-gray-500' : ''}`}>
            {item.locked ? SECRET_TITLE : item.title}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            {item.nickname} · <time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>
            {edited && ' (수정됨)'}
          </p>
        </header>

        {item.locked ? (
          <SecretUnlockForm onUnlock={unlock} />
        ) : editing ? (
          <div className="mt-6">
            <RequestForm
              mode="edit"
              initial={{ kind: item.kind, title: item.title ?? '', content: item.content ?? '', is_secret: item.is_secret }}
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
          </div>
        ) : (
          <>
            <p className="mt-6 whitespace-pre-wrap leading-relaxed text-gray-800">{item.content}</p>
            {answered && <RequestAnswer answer={item.answer!} answeredAt={item.answered_at} />}
            <footer className="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 pt-5 text-sm">
              {answered ? (
                <span className="mr-auto text-gray-500">답변이 달려 수정할 수 없습니다.</span>
              ) : (
                <button type="button" onClick={() => setEditing(true)} className="rounded border border-gray-300 px-3 py-1.5">
                  수정
                </button>
              )}
              <button type="button" onClick={() => setDeleting(true)} className="rounded border border-red-300 px-3 py-1.5 text-red-600">
                삭제
              </button>
            </footer>
          </>
        )}
      </article>

      {deleting && (
        <PasswordDialog
          title="요청 삭제"
          description={
            answered
              ? '운영자 답변도 함께 삭제됩니다. 작성할 때 입력한 비밀번호를 입력해 주세요.'
              : '작성할 때 입력한 비밀번호를 입력해 주세요.'
          }
          confirmLabel="삭제"
          onConfirm={remove}
          onCancel={() => setDeleting(false)}
        />
      )}
    </main>
  )
}
