// 댓글 타입 (API_SPEC v1.0 §4.3, §11 / COMPONENT_SPEC §11)

export interface Comment {
  id: number
  nickname: string | null // is_deleted면 null
  content: string | null // is_deleted면 null
  is_deleted: boolean
  created_at: string
  updated_at: string
  replies?: Comment[] // 최상위 댓글만 (답글은 1단계)
}

export interface CommentInput {
  nickname: string
  password: string
  content: string
  parent_comment_id?: number
}

export interface AdminComment {
  id: number
  post_id: number
  post_title: string
  parent_comment_id: number | null
  nickname: string
  content: string
  reply_count: number
  created_at: string
}
