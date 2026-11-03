// COMP-038 CommentForm — 댓글/답글 작성 (REQ-024, REQ-028, REQ-038, DEC-006)
import { useId, useState, type FormEvent } from 'react'
import { CONTENT, NICKNAME, PASSWORD, lengthOk } from '../../lib/commentRules'
import { ApiError } from '../../services/apiClient'
import { commentService } from '../../services/commentService'

interface CommentFormProps {
  postId: number
  parentCommentId?: number
  onSubmitted: () => void | Promise<void>
  onCancel?: () => void
}

export default function CommentForm({ postId, parentCommentId, onSubmitted, onCancel }: CommentFormProps) {
  const id = useId()
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isReply = parentCommentId !== undefined
  const valid = lengthOk(nickname, NICKNAME) && lengthOk(password, PASSWORD) && lengthOk(content, CONTENT)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await commentService.create(postId, {
        nickname: nickname.trim(),
        password: password.trim(),
        content: content.trim(),
        ...(isReply ? { parent_comment_id: parentCommentId } : {}),
      })
      setContent('')
      setPassword('')
      await onSubmitted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 등록하지 못했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const label = isReply ? '답글' : '댓글'
  return (
    <form onSubmit={handleSubmit} aria-label={`${label} 쓰기`} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-nickname`} className="sr-only">
            닉네임
          </label>
          <input
            id={`${id}-nickname`}
            placeholder={`닉네임 (${NICKNAME.min}~${NICKNAME.max}자)`}
            value={nickname}
            maxLength={NICKNAME.max + 10}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor={`${id}-password`} className="sr-only">
            비밀번호
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete="new-password"
            placeholder={`비밀번호 (${PASSWORD.min}자 이상, 수정·삭제할 때 필요)`}
            value={password}
            maxLength={PASSWORD.max + 10}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label htmlFor={`${id}-content`} className="sr-only">
          {label} 내용
        </label>
        <textarea
          id={`${id}-content`}
          rows={isReply ? 2 : 3}
          placeholder={`${label}을 남겨 주세요`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full resize-y rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="flex items-center justify-end gap-2">
        <span className={`mr-auto text-xs ${content.trim().length > CONTENT.max ? 'text-red-600' : 'text-gray-400'}`}>
          {content.trim().length}/{CONTENT.max}
        </span>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm">
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || submitting}
          className="rounded bg-gray-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {submitting ? '등록 중…' : `${label} 등록`}
        </button>
      </div>
    </form>
  )
}
