// 요청 게시판 타입 (API_SPEC v1.0 §11-1, DEC-011)
import type { Page } from './api'

export type RequestKind = 'material' | 'diy' | 'etc'
export type RequestStatusFilter = 'open' | 'answered'

export interface RequestSummary {
  id: number
  kind: RequestKind
  title: string | null // 비밀글이면 null
  nickname: string
  is_secret: boolean
  answered: boolean
  created_at: string
}

export interface RequestDetail {
  id: number
  kind: RequestKind
  title: string | null // locked면 null
  content: string | null
  nickname: string
  is_secret: boolean
  locked: boolean // 비밀글인데 비밀번호를 아직 확인하지 않음
  answer: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

export interface RequestInput {
  kind: RequestKind
  title: string
  content: string
  password: string
  is_secret: boolean
  nickname?: string // 작성할 때만
}

export interface AdminRequest {
  id: number
  kind: RequestKind
  title: string
  content: string
  nickname: string
  is_secret: boolean
  answer: string | null
  answered_at: string | null
  created_at: string
  updated_at: string
}

export interface AdminRequestPage extends Page<AdminRequest> {
  open_count: number
}
