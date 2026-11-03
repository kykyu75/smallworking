// COMP-036 CommentItem — 댓글 1개 (REQ-025~029, DEC-005, COMPONENT_SPEC §8.5)
// | 상태 | 표시 | 버튼 |
// | 일반 댓글 | 닉네임·내용·작성일 | [답글][수정][삭제] |
// | 답글 | 같음(들여쓰기) | [수정][삭제] — [답글] 없음 (1단계) |
// | 삭제된 댓글 | "삭제된 댓글입니다" | 없음 |
import { useId, useState, type FormEvent } from 'react'
import { CONTENT, PASSWORD, lengthOk } from '../../lib/commentRules'
import { formatDateTime } from '../../lib/format'
import { ApiError } from '../../services/apiClient'
import type { Comment } from '../../types/comment'

interface CommentItemProps {
  comment: Comment
  isReply: boolean
  onReply?: () => void
  onEdit: (password: string, content: string) => Promise<void>
  onDelete: () => void
}

function EditForm({ initial, onSave, onCancel }: { initial: string; onSave: (password: string, content: string) => Promise<void>; onCancel: () => void }) {
  const id = useId()
  const [content, setContent] = useState(initial)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const valid = lengthOk(content, CONTENT) && lengthOk(password, PASSWORD)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSave(password.trim(), content.trim())
    } catch (err) {
      // 비밀번호가 틀리면 입력한 내용을 그대로 두고 안내 (TC-COM-011)
      setError(err instanceof ApiError ? err.message : '수정하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="댓글 수정" className="mt-2 space-y-2">
      <label htmlFor={`${id}-content`} className="sr-only">
        수정할 내용
      </label>
      <textarea
        id={`${id}-content`}
        rows={3}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-password`} className="sr-only">
          비밀번호
        </label>
        <input
          id={`${id}-password`}
          type="password"
          autoComplete="off"
          placeholder="작성할 때 입력한 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm"
        />
        <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-3 py-1.5 text-sm">
          취소
        </button>
        <button type="submit" disabled={!valid || busy} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">
          저장
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}

export default function CommentItem({ comment, isReply, onReply, onEdit, onDelete }: CommentItemProps) {
  const [editing, setEditing] = useState(false)

  if (comment.is_deleted) {
    return <p className="py-3 text-sm text-gray-400">삭제된 댓글입니다</p>
  }

  const edited = comment.updated_at !== comment.created_at
  const action = 'text-xs text-gray-500 hover:text-gray-900'

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium text-gray-900">{comment.nickname}</span>
        <time dateTime={comment.created_at} className="text-xs text-gray-400">
          {formatDateTime(comment.created_at)}
        </time>
        {edited && <span className="text-xs text-gray-400">(수정됨)</span>}
      </div>

      {editing ? (
        <EditForm
          initial={comment.content ?? ''}
          onCancel={() => setEditing(false)}
          onSave={async (password, content) => {
            await onEdit(password, content)
            setEditing(false)
          }}
        />
      ) : (
        <>
          {/* 일반 텍스트로만 표시, 줄바꿈 유지 (REQ-044, TC-COM-021) */}
          <p className="mt-1 whitespace-pre-wrap text-gray-800">{comment.content}</p>
          <div className="mt-1 flex gap-3">
            {!isReply && onReply && (
              <button type="button" onClick={onReply} className={action}>
                답글
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)} className={action}>
              수정
            </button>
            <button type="button" onClick={onDelete} className={action}>
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  )
}
