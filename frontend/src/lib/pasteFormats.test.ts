// DEC-009 붙여넣기 형식 판단·정리 (TC-POST-020~023)
import { describe, expect, it } from 'vitest'
import {
  choosePasteFormat,
  remapHeadingsInHtml,
  remapHeadingsInMarkdown,
  sanitizePastedDoc,
  unnestTablesInHtml,
} from './pasteFormats'
import type { TiptapNode } from '../types/post'

const p = (text: string): TiptapNode => ({ type: 'paragraph', content: [{ type: 'text', text }] })
const td = (text: string, attrs?: Record<string, unknown>): TiptapNode => ({ type: 'tableCell', attrs, content: [p(text)] })
const tr = (...cells: TiptapNode[]): TiptapNode => ({ type: 'tableRow', content: cells })

describe('choosePasteFormat (TC-POST-020)', () => {
  it('Markdown 원문은 markdown', () => {
    expect(choosePasteFormat('## 제목\n본문', '')).toBe('markdown')
    expect(choosePasteFormat('- 하나\n- 둘', '')).toBe('markdown')
    expect(choosePasteFormat('1. 가\n2. 나', '')).toBe('markdown')
    expect(choosePasteFormat('이것은 **굵게** 입니다', '')).toBe('markdown')
    expect(choosePasteFormat('[링크](https://a.com)', '')).toBe('markdown')
    expect(choosePasteFormat('```\ncode\n```', '')).toBe('markdown')
    expect(choosePasteFormat('> 인용', '')).toBe('markdown')
  })

  it('HTML 소스는 html-source', () => {
    expect(choosePasteFormat('<h2>제목</h2><p>본문</p>', '')).toBe('html-source')
    expect(choosePasteFormat('  <!DOCTYPE html><html><body><p>x</p></body></html>', '')).toBe('html-source')
  })

  it('일반 글·빈 글은 기본 붙여넣기', () => {
    expect(choosePasteFormat('그냥 문장입니다.\n둘째 줄', '')).toBe('default')
    expect(choosePasteFormat('3 < 5 이고 a > b', '')).toBe('default')
    expect(choosePasteFormat('   ', '')).toBe('default')
  })

  it('서식 있는 복사(웹페이지·ChatGPT 화면)는 기본 붙여넣기에 맡긴다', () => {
    expect(choosePasteFormat('## 제목', '<h2>제목</h2>')).toBe('default')
    expect(choosePasteFormat('굵게', '<p><strong>굵게</strong></p>')).toBe('default')
  })

  it('VS Code처럼 span·div만 있는 HTML이면 텍스트를 검사한다', () => {
    const vscodeHtml = '<div style="color:#ccc"><div><span>## 제목</span></div></div>'
    expect(choosePasteFormat('## 제목', vscodeHtml)).toBe('markdown')
  })
})

describe('제목 단계 맞추기 (TC-POST-021)', () => {
  it('Markdown: # → ##, #### → ###, 코드블록 안은 그대로', () => {
    const md = '# 큰\n#### 작은\n```\n# 주석\n```\n## 그대로'
    expect(remapHeadingsInMarkdown(md)).toBe('## 큰\n### 작은\n```\n# 주석\n```\n## 그대로')
  })

  it('HTML: h1 → h2, h4~h6 → h3', () => {
    expect(remapHeadingsInHtml('<h1 class="x">a</h1><h5>b</h5><h2>c</h2>')).toBe(
      '<h2 class="x">a</h2><h3>b</h3><h2>c</h2>',
    )
  })
})

describe('sanitizePastedDoc (TC-POST-022, TC-SEC-014)', () => {
  it('위험한 링크·허용되지 않은 마크·이미지를 뺀다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '나쁜', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
            { type: 'text', text: '밑줄', marks: [{ type: 'underline' }] },
            { type: 'image', attrs: { src: 'https://evil/x.png' } },
          ],
        },
        { type: 'image', attrs: { imageId: 3 } },
      ],
    })
    expect(doc).toEqual({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '나쁜' }, { type: 'text', text: '밑줄' }] }],
    })
  })

  it('모르는 블록은 껍데기만 벗기고 글자를 살린다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [{ type: 'details', content: [{ type: 'paragraph', content: [{ type: 'text', text: '접힌 글' }] }] }],
    })
    expect(doc.content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: '접힌 글' }] }])
  })

  it('블록 자리의 글자는 문단으로 감싸고 빈 문단·빈 목록은 뺀다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        { type: 'text', text: '대체 글' },
        { type: 'paragraph' },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph' }, { type: 'text', text: '할일' }] }] },
        { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'image', attrs: { imageId: 1 } }] }] },
      ],
    })
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [{ type: 'text', text: '대체 글' }] },
      {
        type: 'bulletList',
        content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: '할일' }] }] }],
      },
    ])
  })

  it('제목 단계는 2·3으로 맞춘다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'a' }] },
        { type: 'heading', attrs: { level: 6 }, content: [{ type: 'text', text: 'b' }] },
      ],
    })
    expect(doc.content?.map((n) => n.attrs?.level)).toEqual([2, 3])
  })
})

describe('표 붙여넣기 정리 (DEC-010, TC-POST-027)', () => {
  it('Markdown 표 구분 줄이 있으면 markdown으로 본다', () => {
    expect(choosePasteFormat('| a | b |\n|---|:---:|\n| 1 | 2 |', '')).toBe('markdown')
    expect(choosePasteFormat('a | b\n--- | ---\n1 | 2', '')).toBe('markdown')
  })

  it('표는 그대로 두고 칸 합치기·너비·잘못된 정렬은 뺀다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            tr(td('a', { align: 'center', colspan: 2, rowspan: 1, colwidth: [100] }), td('b', { align: 'justify' })),
          ],
        },
      ],
    })
    expect(doc.content).toEqual([{ type: 'table', content: [tr(td('a', { align: 'center' }), td('b'))].map(stripUndefined) }])
  })

  it('짧은 행은 끝에 빈 칸을 채운다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [{ type: 'table', content: [tr(td('a'), td('b'), td('c')), tr(td('d'))] }],
    })
    const rows = doc.content![0].content!
    expect(rows.map((r) => r.content!.length)).toEqual([3, 3])
    expect(rows[1].content![2]).toEqual({ type: 'tableCell', content: [{ type: 'paragraph' }] })
  })

  it('표 안의 표는 풀어서 글자만 칸에 남긴다', () => {
    const inner: TiptapNode = { type: 'table', content: [tr(td('안1'), td('안2'))] }
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [{ type: 'table', content: [tr({ type: 'tableCell', content: [inner] })] }],
    })
    expect(doc.content).toEqual([{ type: 'table', content: [tr({ type: 'tableCell', content: [p('안1'), p('안2')] })].map(stripUndefined) }])
  })

  it('빈 칸은 빈 문단으로 남기고, 칸 아닌 것은 칸으로 감싸며, 표 밖의 행·칸은 껍데기를 벗긴다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        { type: 'table', content: [tr({ type: 'tableCell', content: [{ type: 'image', attrs: { imageId: 1 } }] }, p('행에 바로 온 문단'))] },
        tr(td('떨어진 칸')),
        { type: 'table', content: [] },
      ],
    })
    expect(doc.content).toEqual([
      {
        type: 'table',
        content: [tr({ type: 'tableCell', content: [{ type: 'paragraph' }] }, { type: 'tableCell', content: [p('행에 바로 온 문단')] })],
      },
      p('떨어진 칸'),
    ])
  })

  it('HTML 소스의 표 안 표는 문단으로 푼다', () => {
    const html = '<table><tr><td>a</td><td><table><tbody><tr><td>안1</td><td> </td><td>안2</td></tr></tbody></table></td></tr></table>'
    const out = unnestTablesInHtml(html)
    expect(out.match(/<table/g)).toHaveLength(1)
    expect(out).toContain('<p>안1</p><p>안2</p>')
    expect(unnestTablesInHtml('<p>표 없음</p>')).toBe('<p>표 없음</p>')
  })
})

/** attrs: undefined 같은 빈 항목을 없앤다 (normalizeDoc 결과와 비교하기 위해) */
function stripUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}