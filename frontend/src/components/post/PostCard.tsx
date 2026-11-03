// COMP-014 PostCard — 게시글 요약 카드 (REQ-005~007, REQ-023)
// variant="card": 목록용(썸네일 위, 내용 아래) / variant="row": 홈 섹션용(작은 썸네일 옆에 제목)
import { Link } from 'react-router'
import { formatDate } from '../../lib/format'
import type { PostSummary } from '../../types/post'

interface PostCardProps {
  post: PostSummary
  showCategory?: boolean
  variant?: 'card' | 'row'
  rank?: number
}

function Meta({ post, showCategory }: { post: PostSummary; showCategory: boolean }) {
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-gray-500">
      {showCategory && <span className="font-medium text-gray-600">{post.category_name}</span>}
      <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
      <span aria-label={`좋아요 ${post.like_count}`}>❤️ {post.like_count}</span>
      <span aria-label={`댓글 ${post.comment_count}`}>💬 {post.comment_count}</span>
    </p>
  )
}

export default function PostCard({ post, showCategory = false, variant = 'card', rank }: PostCardProps) {
  if (variant === 'row') {
    return (
      <Link to={`/posts/${post.id}`} className="flex items-center gap-3 rounded p-2 hover:bg-gray-50">
        {rank !== undefined && <span className="w-5 shrink-0 text-center text-sm font-bold text-gray-400">{rank}</span>}
        {post.thumbnail_url ? (
          <img src={post.thumbnail_url} alt="" loading="lazy" className="size-14 shrink-0 rounded object-cover" />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-medium text-gray-900">{post.title}</p>
          <Meta post={post} showCategory={showCategory} />
        </div>
      </Link>
    )
  }

  return (
    <Link
      to={`/posts/${post.id}`}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white hover:border-gray-400"
    >
      {post.thumbnail_url && (
        <img src={post.thumbnail_url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
      )}
      <div className="flex-1 p-4">
        <p className="line-clamp-2 font-semibold text-gray-900">{post.title}</p>
        <Meta post={post} showCategory={showCategory} />
      </div>
    </Link>
  )
}
