// 좋아요 API (API-018 좋아요, API-022 취소). 방문자 쿠키(sw_visitor)는 서버가 발급·관리한다.
import { api } from './apiClient'

export interface LikeResult {
  post_id: number
  like_count: number
  liked: boolean
}

export const likeService = {
  like: (postId: number) => api.post<LikeResult>(`/api/posts/${postId}/like`),
  unlike: (postId: number) => api.delete<LikeResult>(`/api/posts/${postId}/like`),
}
