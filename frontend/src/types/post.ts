// 게시글 타입 (API_SPEC v1.0 §4.1, §6 / COMPONENT_SPEC §11)
import type { PostImage } from './image'

export interface TiptapMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TiptapNode[]
  marks?: TiptapMark[]
  text?: string
}

export interface TiptapDoc extends TiptapNode {
  type: 'doc'
}

export interface PostSummary {
  id: number
  category_id: number
  category_name: string
  title: string
  thumbnail_url: string | null
  like_count: number
  comment_count: number
  created_at: string // ISO 8601 (UTC)
  updated_at: string
}

export interface PostDetail extends PostSummary {
  content: TiptapDoc
  images: PostImage[]
  liked: boolean
}

export interface PostInput {
  category_id: number
  title: string
  content: TiptapDoc
}
