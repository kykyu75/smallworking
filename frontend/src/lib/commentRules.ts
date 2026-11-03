// 댓글 입력 규칙 (DEC-006) — Backend(schemas/comment.py)와 같아야 한다. 앞뒤 공백을 뺀 길이로 판단한다.
export const NICKNAME = { min: 2, max: 20 }
export const PASSWORD = { min: 4, max: 64 }
export const CONTENT = { min: 1, max: 1000 }

export function lengthOk(value: string, rule: { min: number; max: number }): boolean {
  const length = value.trim().length
  return length >= rule.min && length <= rule.max
}
