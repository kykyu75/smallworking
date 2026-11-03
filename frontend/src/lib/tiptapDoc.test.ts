import { describe, expect, it } from 'vitest'
import type { TiptapNode } from '../types/post'
import { collectImageIds, hasBody, normalizeDoc } from './tiptapDoc'

describe('normalizeDoc (DEC-001: 허용된 노드·마크·속성만 저장)', () => {
  it('TipTap이 붙이는 링크 target·rel·class와 null 속성을 뺀다', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: '링크',
              marks: [{ type: 'link', attrs: { href: 'https://example.com', target: '_blank', rel: 'noopener', class: null } }],
            },
          ],
        },
        { type: 'orderedList', attrs: { start: 1, type: null }, content: [] },
        { type: 'codeBlock', attrs: { language: null }, content: [{ type: 'text', text: 'x' }] },
        { type: 'image', attrs: { imageId: 7, alt: null } },
      ],
    }
    expect(normalizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: '링크', marks: [{ type: 'link', attrs: { href: 'https://example.com' } }] }] },
        { type: 'orderedList', attrs: { start: 1 } },
        { type: 'codeBlock', content: [{ type: 'text', text: 'x' }] },
        { type: 'image', attrs: { imageId: 7 } },
      ],
    })
  })

  it('허용 목록에 없는 노드·마크와 위험한 링크는 없앤다', () => {
    const doc: TiptapNode = {
      type: 'doc',
      content: [
        { type: 'iframe', attrs: { src: 'https://evil' } },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'underline' }, { type: 'bold' }] },
            { type: 'text', text: 'b', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
        { type: 'image', attrs: { src: 'https://x/y.png' } }, // imageId 없음
      ],
    }
    expect(normalizeDoc(doc)).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'a', marks: [{ type: 'bold' }] },
            { type: 'text', text: 'b' },
          ],
        },
      ],
    })
  })
})

describe('collectImageIds / hasBody', () => {
  const doc: TiptapNode = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '   ' }] },
      { type: 'image', attrs: { imageId: 3 } },
      { type: 'blockquote', content: [{ type: 'image', attrs: { imageId: 1 } }] },
    ],
  }

  it('이미지를 본문 등장 순서대로 모은다', () => {
    expect(collectImageIds(doc)).toEqual([3, 1])
  })

  it('공백만 있으면 빈 본문, 이미지나 글자가 있으면 본문이 있다', () => {
    expect(hasBody({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '  ' }] }] })).toBe(false)
    expect(hasBody({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false)
    expect(hasBody(doc)).toBe(true)
    expect(hasBody({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '글' }] }] })).toBe(true)
  })
})
