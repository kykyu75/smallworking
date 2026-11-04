// COMP-042 RequestForm — 요청 작성·수정 (REQ-045, REQ-048, DEC-011)
// 작성: 닉네임 포함 / 수정: 닉네임 없음, 비밀번호로 본인 확인
import { useId, useState, type FormEvent } from 'react'
import { BODY, KINDS, KIND_LABELS, NICKNAME, PASSWORD, TITLE, lengthOk } from '../../lib/requestRules'
import { ApiError } from '../../services/apiClient'
import type { RequestInput, RequestKind } from '../../types/request'

interface RequestFormProps {
  mode: 'create' | 'edit'
  initial?: { kind: RequestKind; title: string; content: string; is_secret: boolean }
  onSubmit: (input: RequestInput) => Promise<void>
  onCancel?: () => void
}

const inputClass = 'mt-1 w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm'

export default function RequestForm({ mode, initial, onSubmit, onCancel }: RequestFormProps) {
  const id = useId()
  const [kind, setKind] = useState<RequestKind>(initial?.kind ?? 'material')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [content, setContent] = useState(initial?.content ?? '')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [isSecret, setIsSecret] = useState(initial?.is_secret ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreate = mode === 'create'
  const valid =
    lengthOk(title, TITLE) &&
    lengthOk(content, BODY) &&
    lengthOk(password, PASSWORD) &&
    (!isCreate || lengthOk(nickname, NICKNAME))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        kind,
        title: title.trim(),
        content: content.trim(),
        password: password.trim(),
        is_secret: isSecret,
        ...(isCreate ? { nickname: nickname.trim() } : {}),
      })
    } catch (err) {
      // 실패해도 입력한 내용은 그대로 둔다
      setError(err instanceof ApiError ? err.message : '저장하지 못했습니다.')
      setBusy(false)
    }
  }

  const titleLength = title.trim().length
  const contentLength = content.trim().length

  return (
    <form onSubmit={handleSubmit} aria-label={isCreate ? '요청 작성' : '요청 수정'} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">종류</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {KINDS.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm ${kind === value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 bg-white text-gray-700'}`}
            >
              <input
                type="radio"
                name={`${id}-kind`}
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {KIND_LABELS[value]}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor={`${id}-title`} className="text-sm font-medium">
          제목 ({TITLE.min}~{TITLE.max}자)
        </label>
        <input id={`${id}-title`} value={title} maxLength={TITLE.max + 20} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        <p className={`mt-1 text-right text-xs ${titleLength > TITLE.max ? 'text-red-600' : 'text-gray-400'}`}>
          {titleLength}/{TITLE.max}
        </p>
      </div>

      <div>
        <label htmlFor={`${id}-content`} className="text-sm font-medium">
          내용
        </label>
        <textarea
          id={`${id}-content`}
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="필요한 자료나 만들어 보고 싶은 것을 자유롭게 적어 주세요."
          className={`${inputClass} resize-y`}
        />
        <p className={`mt-1 text-right text-xs ${contentLength > BODY.max ? 'text-red-600' : 'text-gray-400'}`}>
          {contentLength}/{BODY.max}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isCreate && (
          <div>
            <label htmlFor={`${id}-nickname`} className="text-sm font-medium">
              닉네임 ({NICKNAME.min}~{NICKNAME.max}자)
            </label>
            <input
              id={`${id}-nickname`}
              value={nickname}
              maxLength={NICKNAME.max + 10}
              onChange={(e) => setNickname(e.target.value)}
              className={inputClass}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${id}-password`} className="text-sm font-medium">
            비밀번호 {isCreate ? `(${PASSWORD.min}자 이상, 열람·수정·삭제할 때 필요)` : '(작성할 때 입력한 비밀번호)'}
          </label>
          <input
            id={`${id}-password`}
            type="password"
            autoComplete={isCreate ? 'new-password' : 'off'}
            value={password}
            maxLength={PASSWORD.max + 10}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isSecret} onChange={(e) => setIsSecret(e.target.checked)} className="size-4" />
        비밀글 (작성자와 운영자만 볼 수 있습니다)
      </label>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm">
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!valid || busy}
          className="rounded bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? '저장 중…' : isCreate ? '요청 등록' : '수정 저장'}
        </button>
      </div>
    </form>
  )
}
