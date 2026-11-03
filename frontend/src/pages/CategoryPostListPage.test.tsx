import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { DEFAULT_CATEGORIES, mockApi, postSummary } from '../test/mockApi'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname + location.search}</div>
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const PAGE_1 = { items: [postSummary(3, '셋째'), postSummary(2, '둘째'), postSummary(1, '첫째')], page: 1, size: 12, total: 30 }

describe('카테고리 게시글 목록 (PAGE-002)', () => {
  // TC-POST-011: 카테고리 제목·설명, 최신순 목록(서버 순서 그대로), 12개 요청
  it('카테고리 제목과 게시글을 보여주고 12개씩 요청한다', async () => {
    const fetchMock = mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts', body: PAGE_1 },
    ])
    renderAt('/category/1')
    expect(await screen.findByRole('heading', { level: 1, name: 'DIY' })).toBeInTheDocument()
    expect(screen.getByText('직접 만들어 본 것들')).toBeInTheDocument()
    const list = await screen.findByRole('list', { name: 'DIY 게시글' })
    expect(within(list).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/posts/3', '/posts/2', '/posts/1'])
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?category_id=1&page=1&size=12')).toBe(true)
  })

  // TC-POST-013, TC-POST-016: 페이지 이동은 주소에 남고, 주소의 페이지로 바로 열 수 있다
  it('페이지를 바꾸면 주소에 ?page=n이 남는다', async () => {
    const fetchMock = mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts', body: PAGE_1 },
    ])
    renderAt('/category/1')
    await screen.findByRole('list', { name: 'DIY 게시글' })
    fireEvent.click(within(screen.getByRole('navigation', { name: '페이지' })).getByRole('button', { name: '2' }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/category/1?page=2'))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?category_id=1&page=2&size=12')).toBe(true))
  })

  it('주소의 페이지 번호로 바로 연다', async () => {
    const fetchMock = mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts', body: { ...PAGE_1, page: 3 } },
    ])
    renderAt('/category/1?page=3')
    await screen.findByRole('list', { name: 'DIY 게시글' })
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?category_id=1&page=3&size=12')).toBe(true)
    expect(within(screen.getByRole('navigation', { name: '페이지' })).getByRole('button', { name: '3' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('글이 없으면 안내한다', async () => {
    mockApi([
      { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } },
      { path: '/api/posts', body: { items: [], page: 1, size: 12, total: 0 } },
    ])
    renderAt('/category/3')
    expect(await screen.findByText('아직 글이 없습니다')).toBeInTheDocument()
  })
})
