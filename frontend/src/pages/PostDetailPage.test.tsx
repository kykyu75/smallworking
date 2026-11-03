import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_CATEGORIES, mockApi } from '../test/mockApi'
import type { PostDetail } from '../types/post'

const POST: PostDetail = {
  id: 7,
  category_id: 1,
  category_name: 'DIY',
  title: '주방 타일 시공',
  thumbnail_url: '/uploads/images/2026/11/a_thumb.jpg',
  like_count: 12,
  comment_count: 0,
  created_at: '2026-09-15T01:00:00Z',
  updated_at: '2026-09-15T01:00:00Z',
  liked: false,
  content: {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: '오늘은 타일 작업을 했다.' }] },
      { type: 'image', attrs: { imageId: 5, alt: '완성' } },
      { type: 'paragraph', content: [{ type: 'text', text: '생각보다 쉽지 않았다.' }] },
    ],
  },
  images: [
    {
      id: 5,
      url: '/uploads/images/2026/11/a.jpg',
      thumbnail_url: '/uploads/images/2026/11/a_thumb.jpg',
      original_name: 'a.jpg',
      mime_type: 'image/jpeg',
      file_size: 1,
      width: 1920,
      height: 1440,
    },
  ],
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('게시글 상세 (PAGE-003)', () => {
  // TC-POST-009, TC-POST-010
  it('카테고리·제목·작성자·작성일·본문·이미지·좋아요 수를 보여준다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts/7', body: POST },
    ])
    renderAt('/posts/7')
    expect(await screen.findByRole('heading', { level: 1, name: '주방 타일 시공' })).toBeInTheDocument()
    const article = screen.getByRole('article')
    expect(article).toHaveTextContent('SmallWorking') // 작성자는 운영자
    expect(article.querySelector('time')).toHaveAttribute('dateTime', '2026-09-15T01:00:00Z')
    expect(screen.getByText('오늘은 타일 작업을 했다.')).toBeInTheDocument()
    expect(screen.getByAltText('완성')).toHaveAttribute('src', '/uploads/images/2026/11/a.jpg')
    expect(screen.getByRole('button', { name: '좋아요 (현재 12)' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByText(/수정됨/)).toBeNull()
    await waitFor(() => expect(document.title).toBe('주방 타일 시공 - SmallWorking'))
    expect(screen.getAllByRole('link', { name: /DIY/ }).some((a) => a.getAttribute('href') === '/category/1')).toBe(true)
  })

  it('수정된 글은 (수정됨)을 표시한다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts/7', body: { ...POST, updated_at: '2026-09-20T03:00:00Z' } },
    ])
    renderAt('/posts/7')
    expect(await screen.findByText(/수정됨/)).toBeInTheDocument()
  })

  // TC-POST-014: 없는 게시글
  it('없는 게시글이면 404 안내를 보여준다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts/999', status: 404, body: { error: { code: 'POST_NOT_FOUND', message: '게시글을 찾을 수 없습니다.', details: null } } },
    ])
    renderAt('/posts/999')
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
  })

  it('숫자가 아닌 주소도 404 안내를 보여준다', async () => {
    mockApi([{ path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }])
    renderAt('/posts/abc')
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
  })
})
