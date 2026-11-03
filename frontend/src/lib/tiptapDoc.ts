// TipTap 문서 도구 — 허용 목록은 Backend(content_validation.py)·DATA_MODEL v1.0 §5.4와 같아야 한다 (DEC-001)
import type { TiptapDoc, TiptapMark, TiptapNode } from '../types/post'

export const SAFE_LINK = /^(https?:\/\/|mailto:)/i

/** 노드별 저장할 속성. 그 외 속성(TipTap이 붙이는 target, rel, class 등)은 저장 전에 뺀다. */
export const NODE_ATTRS: Record<string, readonly string[]> = {
  doc: [],
  paragraph: [],
  text: [],
  heading: ['level'],
  bulletList: [],
  orderedList: ['start'],
  listItem: [],
  blockquote: [],
  codeBlock: ['language'],
  horizontalRule: [],
  hardBreak: [],
  image: ['imageId', 'alt'],
}

export const MARK_ATTRS: Record<string, readonly string[]> = {
  bold: [],
  italic: [],
  strike: [],
  code: [],
  link: ['href'],
}

function pickAttrs(attrs: Record<string, unknown> | undefined, allowed: readonly string[]) {
  if (!attrs) return undefined
  const picked: Record<string, unknown> = {}
  for (const key of allowed) {
    const value = attrs[key]
    if (value !== null && value !== undefined && value !== '') picked[key] = value
  }
  return Object.keys(picked).length > 0 ? picked : undefined
}

function normalizeMarks(marks: TiptapMark[] | undefined): TiptapMark[] | undefined {
  if (!marks) return undefined
  const kept: TiptapMark[] = []
  for (const mark of marks) {
    const allowed = MARK_ATTRS[mark.type]
    if (!allowed) continue
    const attrs = pickAttrs(mark.attrs, allowed)
    if (mark.type === 'link' && (typeof attrs?.href !== 'string' || !SAFE_LINK.test(attrs.href))) continue
    kept.push(attrs ? { type: mark.type, attrs } : { type: mark.type })
  }
  return kept.length > 0 ? kept : undefined
}

function normalizeNode(node: TiptapNode): TiptapNode | null {
  const allowed = NODE_ATTRS[node.type]
  if (!allowed) return null
  const out: TiptapNode = { type: node.type }
  const attrs = pickAttrs(node.attrs, allowed)
  if (attrs) out.attrs = attrs
  if (node.type === 'text') {
    if (!node.text) return null
    out.text = node.text
    const marks = normalizeMarks(node.marks)
    if (marks) out.marks = marks
    return out
  }
  if (node.type === 'image' && typeof attrs?.imageId !== 'number') return null
  if (node.content) {
    const children = node.content.map(normalizeNode).filter((n): n is TiptapNode => n !== null)
    if (children.length > 0) out.content = children
  }
  return out
}

/** 저장 전 정리: 허용된 노드·마크·속성만 남긴다. */
export function normalizeDoc(doc: TiptapNode): TiptapDoc {
  const normalized = normalizeNode({ ...doc, type: 'doc' })
  return (normalized ?? { type: 'doc' }) as TiptapDoc
}

/** 본문 등장 순서대로 imageId 목록 */
export function collectImageIds(node: TiptapNode): number[] {
  const ids: number[] = []
  const walk = (n: TiptapNode) => {
    if (n.type === 'image' && typeof n.attrs?.imageId === 'number') ids.push(n.attrs.imageId)
    n.content?.forEach(walk)
  }
  walk(node)
  return ids
}

/** 글자(공백 제외)나 이미지가 하나라도 있는가 — 빈 본문은 저장하지 않는다 */
export function hasBody(node: TiptapNode): boolean {
  if (node.type === 'image') return true
  if (node.type === 'text') return Boolean(node.text?.trim())
  return node.content?.some(hasBody) ?? false
}

export const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [{ type: 'paragraph' }] }
