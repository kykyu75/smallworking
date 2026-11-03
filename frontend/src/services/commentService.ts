// 댓글 API (API-014~017) + 관리자 댓글 API (API-026, 027)
import type { Page } from '../types/api'
import type { AdminComment, Comment, CommentInput } from '../types/comment'
import { api } from './apiClient'

export const commentService = {
  list: async (postId: number) => (await api.get<{ items: Comment[] }>(`/api/posts/${postId}/comments`)).items,
  create: (postId: number, input: CommentInput) => api.post<Comment>(`/api/posts/${postId}/comments`, input),
  update: (id: number, password: string, content: string) => api.put<Comment>(`/api/comments/${id}`, { password, content }),
  // DELETE 본문은 버려질 수 있어 POST .../delete (API-017)
  remove: (id: number, password: string) => api.post<void>(`/api/comments/${id}/delete`, { password }),
}

export const adminCommentService = {
  list: (page: number, size = 20) => api.get<Page<AdminComment>>('/api/admin/comments', { query: { page, size } }),
  remove: (id: number) => api.delete<void>(`/api/admin/comments/${id}`),
}
