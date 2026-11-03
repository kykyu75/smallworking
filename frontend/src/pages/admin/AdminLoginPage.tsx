// PAGE-101 / COMP-103 AdminLoginPage (REQ-042, COMPONENT_SPEC §9.1)
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAdminAuth } from '../../hooks/useAdminAuth'
import { safeRedirect } from '../../lib/redirect'
import { ApiError } from '../../services/apiClient'

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function lockedMessage(error: ApiError): string {
  const details = error.details
  const lockedUntil =
    details && !Array.isArray(details) && typeof details.locked_until === 'string' ? details.locked_until : null
  const time = lockedUntil ? formatTime(lockedUntil) : ''
  return time ? `${error.message} (${time} 이후 다시 시도할 수 있습니다)` : error.message
}

export default function AdminLoginPage() {
  const { status, login } = useAdminAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectTo = safeRedirect(searchParams.get('redirect'))

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'authenticated' && !submitting) return <Navigate to={redirectTo} replace />

  const canSubmit = username.trim().length > 0 && password.length > 0 && !submitting

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await login({ username: username.trim(), password })
      navigate(redirectTo, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.code === 'ACCOUNT_LOCKED' ? lockedMessage(err) : err.message)
      } else {
        setError('로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
      setPassword('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">관리자 로그인</h1>

        <label className="mt-6 block text-sm font-medium" htmlFor="admin-username">
          아이디
        </label>
        <input
          id="admin-username"
          name="username"
          autoComplete="username"
          maxLength={50}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />

        <label className="mt-4 block text-sm font-medium" htmlFor="admin-password">
          비밀번호
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
        />

        {error && (
          <p role="alert" className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 w-full rounded bg-gray-900 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? '로그인 중…' : '로그인'}
        </button>
      </form>
    </main>
  )
}
