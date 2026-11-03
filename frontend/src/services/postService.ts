// 게시글 API (API-006~010)
import type { Page } from '../types/api'
import type { PostDetail, PostInput, PostSummary } from '../types/post'
import { api } from './apiClient'

export interface PostListQuery {
  category_id?: number
  page?: number
  size?: number
}

export const postService = {
  list: (query: PostListQuery = {}) => api.get<Page<PostSummary>>('/api/posts', { query: { ...query } }),
  get: (id: number) => api.get<PostDetail>(`/api/posts/${id}`),
  create: (input: PostInput) => api.post<PostDetail>('/api/posts', input),
  update: (id: number, input: PostInput) => api.put<PostDetail>(`/api/posts/${id}`, input),
  remove: (id: number) => api.delete<void>(`/api/posts/${id}`),
}
