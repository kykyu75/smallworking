// COMP-039 PasswordDialog — 댓글 삭제 전 비밀번호 확인 (REQ-027)
// 비밀번호가 틀리면 창을 닫지 않고 서버 메시지를 보여준다.
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { PASSWORD, lengthOk } from '../../lib/commentRules'
import { ApiError } from '../../services/apiClient'

interface PasswordDialogProps {
  title: string
  description: string
  confirmLabel: string
  onConfirm: (password: string) => Promise<void>
  onCancel: () => void
}

export default function PasswordDialog({ title, description, confirmLabel, onConfirm, onCancel }: PasswordDialogProps) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lengthOk(password, PASSWORD) || busy) return
    setBusy(true)
    setError(null)
    try {
      await onConfirm(password.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '처리하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg"
      >
        <h2 id={`${id}-title`} className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
        <label htmlFor={`${id}-password`} className="mt-4 block text-sm font-medium">
          비밀번호
        </label>
        <input
          ref={inputRef}
          id={`${id}-password`}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded border border-gray-300 px-4 py-2 text-sm">
            취소
          </button>
          <button
            type="submit"
            disabled={!lengthOk(password, PASSWORD) || busy}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  )
}
