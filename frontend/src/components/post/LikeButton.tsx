// COMP-033 LikeButton — 좋아요 토글 (DEC-004, REQ-030, REQ-032, COMPONENT_SPEC §8.4)
// - liked=false → 좋아요(API-018), liked=true → 취소(API-022)
// - 누르는 즉시 화면을 바꾸고(낙관적 갱신), 서버 응답 값으로 맞춘다. 실패하면 원래대로 되돌린다.
// - 요청 처리 중에는 버튼을 막아 연속 클릭을 무시한다 (TC-LIKE-006)
import { useState } from 'react'
import { ApiError } from '../../services/apiClient'
import { likeService } from '../../services/likeService'

interface LikeButtonProps {
  postId: number
  initialCount: number
  initialLiked: boolean
}

export default function LikeButton({ postId, initialCount, initialLiked }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    if (pending) return
    const before = { liked, count }
    const next = !liked
    setPending(true)
    setError(null)
    setLiked(next)
    setCount(Math.max(0, count + (next ? 1 : -1)))
    try {
      const result = next ? await likeService.like(postId) : await likeService.unlike(postId)
      setLiked(result.liked)
      setCount(result.like_count)
    } catch (err) {
      setLiked(before.liked)
      setCount(before.count)
      setError(err instanceof ApiError ? err.message : '잠시 후 다시 시도해 주세요.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? `좋아요 취소 (현재 ${count})` : `좋아요 (현재 ${count})`}
        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:cursor-wait ${
          liked ? 'border-red-200 bg-red-50 text-red-600' : 'border-gray-300 text-gray-700 hover:border-gray-400'
        }`}
      >
        <span aria-hidden>{liked ? '❤️' : '🤍'}</span>
        <span>{count}</span>
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
