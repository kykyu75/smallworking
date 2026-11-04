// DEC-009 붙여넣기 형식 판단·정리 (TC-POST-020~023)
import { describe, expect, it } from 'vitest'
import { choosePasteFormat, remapHeadingsInHtml, remapHeadingsInMarkdown, sanitizePastedDoc } from './pasteFormats'

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

  it('모르는 블록(표)은 껍데기만 벗기고 글자를 살린다', () => {
    const doc = sanitizePastedDoc({
      type: 'doc',
      content: [
        {
          type: 'table',
          content: [
            { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '셀' }] }] }] },
          ],
        },
      ],
    })
    expect(doc.content).toEqual([{ type: 'paragraph', content: [{ type: 'text', text: '셀' }] }])
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
