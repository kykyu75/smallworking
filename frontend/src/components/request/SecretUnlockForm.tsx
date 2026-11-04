// COMP-044 SecretUnlockForm — 비밀글 비밀번호 확인 (REQ-047, API-032)
// 틀리거나 잠기면 서버 메시지를 그대로 보여준다 (5회 실패 → 10분 잠금)
import { useId, useState, type FormEvent } from 'react'
import { PASSWORD, lengthOk } from '../../lib/requestRules'
import { ApiError } from '../../services/apiClient'

export default function SecretUnlockForm({ onUnlock }: { onUnlock: (password: string) => Promise<void> }) {
  const id = useId()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!lengthOk(password, PASSWORD) || busy) return
    setBusy(true)
    setError(null)
    try {
      await onUnlock(password.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '확인하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="비밀글 열기" className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-5">
      <p className="text-sm text-gray-700">🔒 비밀글입니다. 작성할 때 입력한 비밀번호를 넣으면 볼 수 있습니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor={`${id}-password`} className="sr-only">
          비밀번호
        </label>
        <input
          id={`${id}-password`}
          type="password"
          autoComplete="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={!lengthOk(password, PASSWORD) || busy}
          className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          열기
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}
