// 붙여넣기 형식 판단·정리 (DEC-009, COMP-132)
// Markdown 원문이나 HTML 소스를 붙여 넣으면 허용 서식(DATA_MODEL §5.4)으로 바꾼다.
// 결과는 항상 normalizeDoc을 거치므로 허용 목록 밖의 노드·마크·링크는 남지 않는다.
import type { TiptapDoc, TiptapNode } from '../types/post'
import { NODE_ATTRS, normalizeDoc } from './tiptapDoc'

export type PasteFormat = 'default' | 'markdown' | 'html-source'

/** 클립보드 HTML에 이런 태그가 있으면 "서식 있는 복사"로 보고 TipTap 기본 붙여넣기에 맡긴다 */
const RICH_HTML_TAG = /<(h[1-6]|ul|ol|li|strong|b|em|i|a|pre|blockquote|table|hr)[\s>/]/i

/** 텍스트가 HTML 소스처럼 보이는가: 태그로 시작하고, 닫는 태그가 하나 이상 있다 */
const HTML_SOURCE_START =
  /^\s*<(!doctype|html|head|body|h[1-6]|p|div|section|article|header|footer|main|ul|ol|li|blockquote|pre|table|strong|em|b|i|a|br|hr)\b/i
const HTML_CLOSE_TAG = /<\/[a-z][a-z0-9]*\s*>|<(br|hr)\s*\/?>/i

/** Markdown 표시 (하나라도 있으면 Markdown으로 본다) */
const MARKDOWN_PATTERNS: readonly RegExp[] = [
  /^#{1,6}\s+\S/m, // 제목
  /^\s{0,3}([-*+]|\d{1,9}[.)])\s+\S/m, // 목록
  /^\s{0,3}(```|~~~)/m, // 코드블록
  /^\s{0,3}>\s?\S/m, // 인용
  /^\s{0,3}([-*_])(\s*\1){2,}\s*$/m, // 구분선
  /\*\*[^*\n]+\*\*|__[^_\n]+__/, // 굵게
  /~~[^~\n]+~~/, // 취소선
  /\[[^\]\n]+\]\([^)\s]+\)/, // 링크
  /`[^`\n]+`/, // 인라인 코드
]

export function choosePasteFormat(text: string, html: string): PasteFormat {
  if (!text.trim()) return 'default'
  // 웹페이지·ChatGPT 화면 복사처럼 서식이 함께 온 경우는 지금처럼 처리한다.
  // VS Code·메모장처럼 span/div만 있는 HTML은 서식이 없으므로 텍스트를 검사한다.
  if (html && RICH_HTML_TAG.test(html)) return 'default'
  if (HTML_SOURCE_START.test(text) && HTML_CLOSE_TAG.test(text)) return 'html-source'
  if (MARKDOWN_PATTERNS.some((pattern) => pattern.test(text))) return 'markdown'
  return 'default'
}

/** HTML 소스의 제목 단계를 허용 단계(h2·h3)로 맞춘다: h1 → h2, h4~h6 → h3 */
export function remapHeadingsInHtml(html: string): string {
  return html
    .replace(/<(\/?)h1(?=[\s>/])/gi, '<$1h2')
    .replace(/<(\/?)h[4-6](?=[\s>/])/gi, '<$1h3')
}

/** Markdown 제목 단계를 허용 단계로 맞춘다 (코드블록 안은 건드리지 않는다): # → ##, #### ~ ###### → ### */
export function remapHeadingsInMarkdown(markdown: string): string {
  let inFence = false
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s{0,3}(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return line.replace(/^(\s{0,3})#(?=\s)/, '$1##').replace(/^(\s{0,3})#{4,6}(?=\s)/, '$1###')
    })
    .join('\n')
}

function headingLevel(value: unknown): number {
  const level = typeof value === 'number' ? value : 2
  return level <= 2 ? 2 : 3
}

const INLINE_TYPES = new Set(['text', 'hardBreak'])
const LIST_TYPES = new Set(['bulletList', 'orderedList'])
/** 자식이 블록이어야 하는 노드 */
const BLOCK_CONTAINERS = new Set(['doc', 'listItem', 'blockquote'])

/** 블록 자리에 끼어든 글자(이미지 대체 글 등)는 문단으로 감싸고, 빈 문단은 뺀다 */
function asBlocks(children: TiptapNode[]): TiptapNode[] {
  const blocks: TiptapNode[] = []
  let inline: TiptapNode[] = []
  const flush = () => {
    if (inline.some((n) => n.type === 'text')) blocks.push({ type: 'paragraph', content: inline })
    inline = []
  }
  for (const child of children) {
    if (INLINE_TYPES.has(child.type)) {
      inline.push(child)
      continue
    }
    flush()
    if (child.type === 'paragraph' && !child.content?.length) continue
    blocks.push(child)
  }
  flush()
  return blocks
}

/** 목록 안에는 목록 항목만 둔다 */
function asListItems(children: TiptapNode[]): TiptapNode[] {
  return children.flatMap((child) => {
    if (child.type === 'listItem') return [child]
    const blocks = asBlocks([child])
    return blocks.length > 0 ? [{ type: 'listItem', content: blocks }] : []
  })
}

/** 허용되지 않는 노드는 감싼 껍데기만 벗기고 안의 내용을 살린다. 이미지는 버린다 (DEC-002). */
function sanitizeNode(node: TiptapNode): TiptapNode[] {
  if (node.type === 'image') return []
  if (node.type === 'text') return node.text ? [node] : []
  let children = (node.content ?? []).flatMap(sanitizeNode)
  if (!NODE_ATTRS[node.type]) return children

  if (BLOCK_CONTAINERS.has(node.type)) children = asBlocks(children)
  if (LIST_TYPES.has(node.type)) children = asListItems(children)
  if (node.type === 'listItem' && children[0] && children[0].type !== 'paragraph') {
    children = [{ type: 'paragraph' }, ...children] // 목록 항목은 문단으로 시작해야 한다
  }
  // 내용이 비어 버린 목록·인용은 남기지 않는다
  if ((LIST_TYPES.has(node.type) || node.type === 'listItem' || node.type === 'blockquote') && children.length === 0) {
    return []
  }

  const out: TiptapNode = { ...node }
  if (node.type === 'heading') out.attrs = { ...node.attrs, level: headingLevel(node.attrs?.level) }
  if (children.length > 0) out.content = children
  else delete out.content
  return [out]
}

/** 붙여 넣을 문서를 허용 서식만 남게 정리한다 */
export function sanitizePastedDoc(doc: TiptapNode): TiptapDoc {
  const [cleaned] = sanitizeNode({ ...doc, type: 'doc' })
  return normalizeDoc(cleaned ?? { type: 'doc' })
}
