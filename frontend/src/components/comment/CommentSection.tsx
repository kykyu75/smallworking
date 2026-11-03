// COMP-034 CommentSection (+ COMP-035 CommentList, COMP-037 ReplyList) — REQ-024~029, DEC-005, DEC-006
// 댓글 목록 조회(API-014), 작성·답글·수정·삭제 후에는 목록을 다시 불러온다 (COMPONENT_SPEC §8.6).
import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../../services/apiClient'
import { commentService } from '../../services/commentService'
import type { Comment } from '../../types/comment'
import EmptyState from '../common/EmptyState'
import CommentForm from './CommentForm'
import CommentItem from './CommentItem'
import PasswordDialog from './PasswordDialog'

function countVisible(comments: Comment[]): number {
  return comments.reduce((sum, c) => sum + (c.is_deleted ? 0 : 1) + (c.replies?.filter((r) => !r.is_deleted).length ?? 0), 0)
}

export default function CommentSection({ postId }: { postId: number }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<Comment | null>(null)

  useEffect(() => {
    let active = true
    commentService
      .list(postId)
      .then((items) => {
        if (active) setComments(items)
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof ApiError ? err.message : '댓글을 불러오지 못했습니다.')
      })
    return () => {
      active = false
    }
  }, [postId])

  const reload = useCallback(async () => {
    try {
      setComments(await commentService.list(postId))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '댓글을 불러오지 못했습니다.')
    }
  }, [postId])

  async function edit(id: number, password: string, content: string) {
    await commentService.update(id, password, content)
    await reload()
  }

  async function confirmDelete(password: string) {
    if (!deleting) return
    await commentService.remove(deleting.id, password) // 비밀번호가 틀리면 예외 → 창이 안내를 띄운다
    setDeleting(null)
    await reload()
  }

  function renderItem(comment: Comment, isReply: boolean) {
    return (
      <CommentItem
        comment={comment}
        isReply={isReply}
        onReply={isReply ? undefined : () => setReplyTo(replyTo === comment.id ? null : comment.id)}
        onEdit={(password, content) => edit(comment.id, password, content)}
        onDelete={() => setDeleting(comment)}
      />
    )
  }

  return (
    <section aria-labelledby="comments-heading" className="mt-10">
      <h2 id="comments-heading" className="text-lg font-bold">
        💬 댓글 {comments ? countVisible(comments) : ''}
      </h2>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      {comments && comments.length === 0 && <EmptyState message="아직 댓글이 없습니다" />}

      {comments && comments.length > 0 && (
        <ol aria-label="댓글 목록" className="mt-2 divide-y divide-gray-100">
          {comments.map((comment) => (
            <li key={comment.id}>
              {renderItem(comment, false)}
              {(comment.replies?.length ?? 0) > 0 && (
                // 답글 들여쓰기: Mobile 12px / Tablet 24px / Desktop 32px (COMPONENT_SPEC §12)
                <ol aria-label="답글 목록" className="ml-1 border-l-2 border-gray-100 pl-3 md:pl-6 lg:pl-8">
                  {comment.replies!.map((reply) => (
                    <li key={reply.id}>{renderItem(reply, true)}</li>
                  ))}
                </ol>
              )}
              {replyTo === comment.id && !comment.is_deleted && (
                <div className="mb-3 pl-3 md:pl-6 lg:pl-8">
                  <CommentForm
                    postId={postId}
                    parentCommentId={comment.id}
                    onCancel={() => setReplyTo(null)}
                    onSubmitted={async () => {
                      setReplyTo(null)
                      await reload()
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6">
        <CommentForm postId={postId} onSubmitted={reload} />
      </div>

      {deleting && (
        <PasswordDialog
          title="댓글 삭제"
          description={
            (deleting.replies?.length ?? 0) > 0
              ? "답글이 있어 '삭제된 댓글입니다'로 표시되고 답글은 남습니다. 작성할 때 입력한 비밀번호를 입력해 주세요."
              : '작성할 때 입력한 비밀번호를 입력해 주세요.'
          }
          confirmLabel="삭제"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
