import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_CATEGORIES, mockApi, postSummary } from '../test/mockApi'

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const HOME = {
  categories: [
    {
      id: 1,
      name: 'DIY',
      description: '직접 만들어 본 것들',
      latest_posts: [
        postSummary(13, '원목 테이블', { thumbnail_url: '/uploads/images/2026/11/t_thumb.jpg', like_count: 32, comment_count: 4 }),
        postSummary(12, '선반'),
        postSummary(11, '의자'),
      ],
    },
    { id: 2, name: 'Portfolio', description: null, latest_posts: [] },
    { id: 9, name: '여행', description: null, latest_posts: [postSummary(20, '제주', { category_id: 9, category_name: '여행' })] },
  ],
  latest_posts: [postSummary(20, '제주', { category_id: 9, category_name: '여행' }), postSummary(13, '원목 테이블')],
  popular_posts: [postSummary(13, '원목 테이블', { like_count: 32 }), postSummary(20, '제주', { category_name: '여행', like_count: 5 })],
}

describe('홈 화면 (PAGE-001)', () => {
  // TC-HOME-001: 소개, 카테고리 영역, 최신 글, 인기 글
  it('소개·카테고리별 최신 글·최신 글·인기 글을 보여준다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/home', body: HOME },
    ])
    renderHome()
    expect(screen.getByRole('heading', { level: 1, name: '지대넓얕' })).toBeInTheDocument()
    // COMP-010 블로그 링크 (새 탭)
    const blog = screen.getByRole('link', { name: '블로그 바로가기 →' })
    expect(blog).toHaveAttribute('href', 'https://blog.naver.com/smallworking')
    expect(blog).toHaveAttribute('target', '_blank')
    expect(blog).toHaveAttribute('rel', 'noopener noreferrer')

    const diy = await screen.findByRole('region', { name: 'DIY' })
    expect(within(diy).getAllByRole('link').map((a) => a.textContent)).toEqual([
      '더보기 →',
      expect.stringContaining('원목 테이블'),
      expect.stringContaining('선반'),
      expect.stringContaining('의자'),
    ])
    expect(within(diy).getByRole('link', { name: '더보기 →' })).toHaveAttribute('href', '/category/1')
    expect(within(diy).getByText('직접 만들어 본 것들')).toBeInTheDocument()

    const latest = screen.getByRole('region', { name: '🆕 최신 글' })
    expect(within(latest).getAllByRole('listitem')).toHaveLength(2)
    const popular = screen.getByRole('region', { name: '🔥 인기 글' })
    expect(within(popular).getAllByRole('listitem')[0]).toHaveTextContent('1원목 테이블')
    expect(within(popular).getByText('여행')).toBeInTheDocument() // 카테고리 이름 표시
  })

  // TC-HOME-005, TC-HOME-007: 새 카테고리도 섹션으로, 글 없는 카테고리는 안내
  it('홈 API가 준 카테고리를 모두 섹션으로 그리고, 글 없는 카테고리는 안내한다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/home', body: HOME },
    ])
    renderHome()
    expect(await screen.findByRole('region', { name: '여행' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Portfolio' })).getByText('아직 글이 없습니다')).toBeInTheDocument()
  })

  // TC-HOME-008: 카드를 누르면 상세로
  it('게시글 카드는 상세 화면으로 연결되고, 썸네일·좋아요·댓글 수를 보여준다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/home', body: HOME },
    ])
    renderHome()
    const diy = await screen.findByRole('region', { name: 'DIY' })
    const card = within(diy).getByRole('link', { name: /원목 테이블/ })
    expect(card).toHaveAttribute('href', '/posts/13')
    expect(card.querySelector('img')).toHaveAttribute('src', '/uploads/images/2026/11/t_thumb.jpg')
    expect(within(card).getByLabelText('좋아요 32')).toBeInTheDocument()
    expect(within(card).getByLabelText('댓글 4')).toBeInTheDocument()
  })

  it('불러오지 못하면 안내한다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/home', status: 500, body: { error: { code: 'INTERNAL_ERROR', message: '잠시 후 다시 시도해 주세요.', details: null } } },
    ])
    renderHome()
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요.')
  })
})
