// 요청 게시판 입력 규칙·표시 문구 (DEC-011) — Backend(schemas/visitor_request.py)와 같아야 한다
import type { RequestKind } from '../types/request'

export { NICKNAME, PASSWORD, lengthOk } from './commentRules'

export const TITLE = { min: 1, max: 100 }
export const BODY = { min: 1, max: 2000 } // 요청 내용·운영자 답변

export const KIND_LABELS: Record<RequestKind, string> = {
  material: '자료 요청',
  diy: 'DIY 요청',
  etc: '기타',
}

export const KINDS = Object.keys(KIND_LABELS) as RequestKind[]

export const SECRET_TITLE = '🔒 비밀글입니다'

export function statusLabel(answered: boolean): string {
  return answered ? '답변 완료' : '접수'
}
