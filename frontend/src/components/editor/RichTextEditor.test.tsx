// COMP-132 붙여넣기 변환 (DEC-009, TC-POST-020~023)
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DOC } from '../../lib/tiptapDoc'
import type { TiptapDoc, TiptapNode } from '../../types/post'
import RichTextEditor from './RichTextEditor'

function setup() {
  const onChange = vi.fn<(doc: TiptapDoc) => void>()
  render(<RichTextEditor initialContent={EMPTY_DOC} initialImages={[]} onChange={onChange} />)
  const box = screen.getByRole('textbox', { name: '본문' })
  const lastDoc = () => onChange.mock.calls.at(-1)?.[0]
  return { box, onChange, lastDoc }
}

function paste(target: HTMLElement, data: Record<string, string>) {
  fireEvent.paste(target, { clipboardData: { getData: (type: string) => data[type] ?? '', types: Object.keys(data) } })
}

/** 블록 종류 목록 (커서가 있던 빈 문단은 붙여넣기 뒤에도 남으므로 제외) */
function types(doc: TiptapDoc | undefined): string[] {
  return (doc?.content ?? [])
    .filter((n: TiptapNode) => !(n.type === 'paragraph' && !n.content?.length))
    .map((n: TiptapNode) => n.type)
}

function allText(node: TiptapNode | undefined): string {
  if (!node) return ''
  if (node.type === 'text') return node.text ?? ''
  return (node.content ?? []).map(allText).join('')
}

describe('RichTextEditor 붙여넣기 (DEC-009)', () => {
  it('TC-POST-020 Markdown 원문 → 제목·목록·굵게·링크·코드블록', async () => {
    const { box, lastDoc } = setup()
    paste(box, {
      'text/plain': '# 제목\n\n본문 **굵게** [링크](https://a.com)\n\n- 하나\n- 둘\n\n```js\nlet a = 1\n```',
    })
    await waitFor(() => expect(types(lastDoc())).toEqual(['heading', 'paragraph', 'bulletList', 'codeBlock']))
    const doc = lastDoc()!
    expect(doc.content![0].attrs?.level).toBe(2)
    const marks = doc.content![1].content!.flatMap((n) => n.marks ?? []).map((m) => m.type)
    expect(marks).toEqual(expect.arrayContaining(['bold', 'link']))
    expect(doc.content![3].attrs?.language).toBe('js')
  })

  it('TC-POST-021 HTML 소스 → 서식, 스크립트·이벤트·외부 이미지는 버린다', async () => {
    const { box, lastDoc } = setup()
    paste(box, {
      'text/plain':
        '<h1 onclick="x()">제목</h1><p>본문 <strong>굵게</strong><img src="https://evil/a.png" onerror="x()"></p><script>alert(1)</script><ul><li>항목</li></ul>',
    })
    await waitFor(() => expect(types(lastDoc())).toEqual(['heading', 'paragraph', 'bulletList']))
    const json = JSON.stringify(lastDoc())
    expect(json).not.toMatch(/script|onclick|onerror|evil|image/)
    expect(lastDoc()!.content![0].attrs?.level).toBe(2)
  })

  it('TC-POST-022 일반 글은 글자 그대로 붙는다', async () => {
    const { box, lastDoc } = setup()
    paste(box, { 'text/plain': '그냥 문장 # 이것도 글자' })
    await waitFor(() => expect(allText(lastDoc())).toBe('그냥 문장 # 이것도 글자'))
    expect(types(lastDoc())).toEqual(['paragraph'])
  })

  it('TC-POST-023 서식 있는 복사는 기존 방식(HTML)으로 붙는다', async () => {
    const { box, lastDoc } = setup()
    paste(box, { 'text/plain': '## 글자', 'text/html': '<p><strong>굵은 글</strong></p>' })
    await waitFor(() => expect(allText(lastDoc())).toBe('굵은 글'))
    expect(types(lastDoc())).toEqual(['paragraph'])
  })
})
