// PAGE-003 PostDetailPage (COMP-030 + COMP-031 PostHeader + COMP-032 PostContent + COMP-033 LikeButton, REQ-022, REQ-040)
// + COMP-034 CommentSection (M8)
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import CommentSection from '../components/comment/CommentSection'
import LoadingSpinner from '../components/common/LoadingSpinner'
import LikeButton from '../components/post/LikeButton'
import PostContent from '../components/post/PostContent'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { formatDate } from '../lib/format'
import { ApiError } from '../services/apiClient'
import { postService } from '../services/postService'
import type { PostDetail } from '../types/post'
import NotFoundPage from './NotFoundPage'

const AUTHOR = 'SmallWorking' // 작성자는 항상 운영자 (PRD, COMP-031)

type State = { status: 'loading' } | { status: 'ok'; post: PostDetail } | { status: 'not-found' } | { status: 'error'; message: string }

// COMP-031 PostHeader
function PostHeader({ post }: { post: PostDetail }) {
  const edited = post.updated_at !== post.created_at
  return (
    <header className="border-b border-gray-200 pb-6">
      <Link to={`/category/${post.category_id}`} className="text-sm font-medium text-gray-500 hover:text-gray-900">
        {post.category_name}
      </Link>
      <h1 className="mt-2 text-2xl font-bold leading-snug md:text-3xl">{post.title}</h1>
      <p className="mt-3 text-sm text-gray-500">
        <span>{AUTHOR}</span>
        <span aria-hidden> · </span>
        <time dateTime={post.created_at}>{formatDate(post.created_at)}</time>
        {edited && (
          <span title={`수정: ${formatDate(post.updated_at)}`}>
            {' '}
            (수정됨 <time dateTime={post.updated_at}>{formatDate(post.updated_at)}</time>)
          </span>
        )}
      </p>
    </header>
  )
}

export default function PostDetailPage() {
  const { postId } = useParams()
  const [state, setState] = useState<{ id: string | undefined; value: State }>({ id: postId, value: { status: 'loading' } })
  const current: State = state.id === postId ? state.value : { status: 'loading' }
  useDocumentTitle(current.status === 'ok' ? current.post.title : null)

  useEffect(() => {
    const id = Number(postId)
    if (!Number.isInteger(id) || id <= 0) {
      Promise.resolve().then(() => setState({ id: postId, value: { status: 'not-found' } }))
      return
    }
    let active = true
    postService
      .get(id)
      .then((post) => {
        if (active) setState({ id: postId, value: { status: 'ok', post } })
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
          setState({ id: postId, value: { status: 'not-found' } })
        } else {
          setState({ id: postId, value: { status: 'error', message: err instanceof ApiError ? err.message : '게시글을 불러오지 못했습니다.' } })
        }
      })
    return () => {
      active = false
    }
  }, [postId])

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

  const { post } = current
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <article>
        <PostHeader post={post} />
        <div className="mt-8">
          <PostContent content={post.content} images={post.images} />
        </div>
        <footer className="mt-10 flex items-center justify-between border-t border-gray-200 pt-6 text-sm text-gray-600">
          <LikeButton key={post.id} postId={post.id} initialCount={post.like_count} initialLiked={post.liked} />
          <Link to={`/category/${post.category_id}`} className="hover:text-gray-900">
            {post.category_name} 목록으로 →
          </Link>
        </footer>
      </article>
      <CommentSection key={post.id} postId={post.id} />
    </main>
  )
}
