// COMP-132 붙여넣기 변환 (DEC-009, TC-POST-020~023)
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EMPTY_DOC, normalizeDoc } from '../../lib/tiptapDoc'
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

  it('TC-POST-027 Markdown 표 → 제목 칸이 있는 표, 정렬 유지', async () => {
    const { box, lastDoc } = setup()
    paste(box, { 'text/plain': '| 재료 | 수량 |\n|---|---:|\n| **원목** | 2 |' })
    await waitFor(() => expect(types(lastDoc())).toEqual(['table']))
    const [header, body] = normalizeDoc(lastDoc()!).content![0].content! // 저장할 때의 모양
    expect(header.content!.map((c) => c.type)).toEqual(['tableHeader', 'tableHeader'])
    expect(body.content![1].attrs).toEqual({ align: 'right' })
    expect(allText(body)).toBe('원목2')
  })

  it('TC-POST-027 웹페이지 표 복사 → 칸 합치기 없이 열 수를 맞추고, 표 안의 표는 푼다', async () => {
    const { box, lastDoc } = setup()
    paste(box, {
      'text/plain': '',
      'text/html':
        '<table><tr><th colspan="2">머리</th></tr><tr><td>a</td><td><table><tr><td>안쪽</td></tr></table></td></tr></table>',
    })
    await waitFor(() => expect(types(lastDoc())).toEqual(['table']))
    // 에디터 안에서는 모든 칸이 colspan 1 (합쳐진 칸 없음), 저장할 때는 속성 자체를 뺀다
    expect(JSON.stringify(lastDoc())).not.toMatch(/"colspan":[2-9]|"rowspan":[2-9]/)
    const saved = normalizeDoc(lastDoc()!)
    const json = JSON.stringify(saved)
    expect(json).not.toMatch(/colspan|rowspan|colwidth/)
    const rows = saved.content![0].content!
    expect(rows.map((r) => r.content!.length)).toEqual([2, 2])
    expect(allText(rows[0].content![0])).toBe('머리')
    expect(json.match(/"type":"table"/g)).toHaveLength(1)
    expect(allText(rows[1].content![1])).toBe('안쪽')
  })

  it('TC-POST-028 표 넣기 버튼 → 3×3 표, 표 안에서만 행·열 버튼이 보인다', async () => {
    const { lastDoc } = setup()
    expect(screen.queryByRole('group', { name: '표 편집' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '표 넣기' }))
    await waitFor(() => expect(types(lastDoc())).toEqual(['table']))
    const rows = () => lastDoc()!.content![0].content!
    expect(rows().map((r) => r.content!.length)).toEqual([3, 3, 3])
    expect(rows()[0].content![0].type).toBe('tableHeader')
    expect(screen.getByRole('button', { name: '표 넣기' })).toBeDisabled()

    const group = await screen.findByRole('group', { name: '표 편집' })
    fireEvent.click(within(group).getByRole('button', { name: '아래에 행 추가' }))
    await waitFor(() => expect(rows()).toHaveLength(4))
    fireEvent.click(within(group).getByRole('button', { name: '오른쪽에 열 추가' }))
    await waitFor(() => expect(rows()[0].content).toHaveLength(4))
    fireEvent.click(within(group).getByRole('button', { name: '열 삭제' }))
    await waitFor(() => expect(rows()[0].content).toHaveLength(3))
    fireEvent.click(within(group).getByRole('button', { name: '행 삭제' }))
    await waitFor(() => expect(rows()).toHaveLength(3))
    fireEvent.click(within(group).getByRole('button', { name: '표 삭제' }))
    await waitFor(() => expect(types(lastDoc())).toEqual([]))
  })

  it('TC-POST-023 서식 있는 복사는 기존 방식(HTML)으로 붙는다', async () => {
    const { box, lastDoc } = setup()
    paste(box, { 'text/plain': '## 글자', 'text/html': '<p><strong>굵은 글</strong></p>' })
    await waitFor(() => expect(allText(lastDoc())).toBe('굵은 글'))
    expect(types(lastDoc())).toEqual(['paragraph'])
  })
})
