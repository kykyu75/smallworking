import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PostImage } from '../../types/image'
import type { TiptapNode } from '../../types/post'
import PostContent from './PostContent'

const IMAGES: PostImage[] = [5, 6].map((id) => ({
  id,
  url: `/uploads/images/2026/11/${id}.jpg`,
  thumbnail_url: `/uploads/images/2026/11/${id}_thumb.jpg`,
  original_name: null,
  mime_type: 'image/jpeg',
  file_size: 1,
  width: 1920,
  height: 1440,
}))

function p(...content: TiptapNode[]): TiptapNode {
  return { type: 'paragraph', content }
}
function t(text: string, marks?: TiptapNode['marks']): TiptapNode {
  return { type: 'text', text, marks }
}

describe('PostContent (COMP-032)', () => {
  // TC-IMG-003, TC-IMG-004: 본문 중간 이미지가 지정한 위치·순서로
  it('문단 사이에 이미지를 본문 순서대로 그린다', () => {
    const { container } = render(
      <PostContent
        images={IMAGES}
        content={{
          type: 'doc',
          content: [p(t('첫 문단')), { type: 'image', attrs: { imageId: 6, alt: '완성 사진' } }, p(t('둘째 문단')), { type: 'image', attrs: { imageId: 5 } }],
        }}
      />,
    )
    const blocks = Array.from(container.querySelector('.post-content')!.children).map((el) =>
      el.tagName === 'FIGURE' ? el.querySelector('img')!.getAttribute('src') : el.textContent,
    )
    expect(blocks).toEqual(['첫 문단', '/uploads/images/2026/11/6.jpg', '둘째 문단', '/uploads/images/2026/11/5.jpg'])
    const img = screen.getByAltText('완성 사진')
    expect(img).toHaveAttribute('loading', 'lazy')
  })

  it('이미지 목록에 없는 imageId는 자리를 생략한다', () => {
    const { container } = render(<PostContent images={[]} content={{ type: 'doc', content: [{ type: 'image', attrs: { imageId: 99 } }] }} />)
    expect(container.querySelector('img')).toBeNull()
  })

  it('허용된 서식을 그린다', () => {
    render(
      <PostContent
        images={[]}
        content={{
          type: 'doc',
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [t('큰 제목')] },
            { type: 'heading', attrs: { level: 3 }, content: [t('작은 제목')] },
            p(t('굵게', [{ type: 'bold' }]), t('기울임', [{ type: 'italic' }]), t('취소', [{ type: 'strike' }]), t('코드', [{ type: 'code' }])),
            { type: 'bulletList', content: [{ type: 'listItem', content: [p(t('항목'))] }] },
            { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('셋'))] }] },
            { type: 'blockquote', content: [p(t('인용'))] },
            { type: 'codeBlock', content: [t('print(1)')] },
            { type: 'horizontalRule' },
          ],
        }}
      />,
    )
    expect(screen.getByRole('heading', { level: 2, name: '큰 제목' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 3, name: '작은 제목' })).toBeInTheDocument()
    expect(screen.getByText('굵게').tagName).toBe('STRONG')
    expect(screen.getByText('기울임').tagName).toBe('EM')
    expect(screen.getByText('취소').tagName).toBe('S')
    expect(screen.getByText('셋').closest('ol')).toHaveAttribute('start', '3')
    expect(screen.getByText('print(1)').closest('pre')).not.toBeNull()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })

  // TC-SEC-012: 외부 링크는 새 창 + noopener noreferrer
  it('안전한 링크는 새 창으로 열고 noopener noreferrer를 붙인다', () => {
    render(<PostContent images={[]} content={{ type: 'doc', content: [p(t('예제', [{ type: 'link', attrs: { href: 'https://example.com' } }]))] }} />)
    const link = screen.getByRole('link', { name: '예제' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // TC-SEC-001~005 (본문): 스크립트는 글자로만, 위험한 링크·모르는 노드는 그리지 않는다
  it('스크립트·위험한 링크·모르는 노드는 실행되거나 그려지지 않는다', () => {
    const { container } = render(
      <PostContent
        images={[]}
        content={{
          type: 'doc',
          content: [
            p(t('<script>alert(1)</script>'), t('<img src=x onerror=alert(1)>')),
            p(t('누르지 마세요', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }])),
            { type: 'iframe', attrs: { src: 'https://evil.example' } },
            { type: 'rawHtml', text: '<b>x</b>' } as TiptapNode,
          ],
        }}
      />,
    )
    expect(container.querySelector('script, iframe, img')).toBeNull()
    expect(screen.getByText('<script>alert(1)</script><img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('누르지 마세요')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('<b>x</b>')
  })
})
