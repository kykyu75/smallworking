import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { DEFAULT_CATEGORIES, mockApi, sentBodies, type MockRoute } from '../../test/mockApi'
import type { PostSummary } from '../../types/post'

const ME: MockRoute = { path: '/api/admin/me', body: { username: 'admin' } }
const CATEGORIES: MockRoute = { path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }

function summary(id: number, title: string): PostSummary {
  return {
    id,
    category_id: 1,
    category_name: 'DIY',
    title,
    thumbnail_url: null,
    like_count: 2,
    comment_count: 5,
    created_at: '2026-11-03T09:00:00Z',
    updated_at: '2026-11-03T09:00:00Z',
  }
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

describe('게시글 관리 화면 (COMP-120, 121)', () => {
  // TC-ADM-006: 20개/페이지, 수정·삭제 버튼
  it('게시글 목록을 20개씩 불러오고 수정·삭제 버튼을 보여준다', async () => {
    const fetchMock = mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts', body: { items: [summary(1, '첫 글'), summary(2, '둘째 글')], page: 1, size: 20, total: 45 } },
    ])
    renderAt('/admin/posts')
    const list = await screen.findByRole('list', { name: '게시글 목록' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(within(list).getAllByRole('link', { name: '수정' })[0]).toHaveAttribute('href', '/admin/posts/1/edit')
    expect(within(list).getAllByText(/좋아요 2 · 댓글 5/)).toHaveLength(2)
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?page=1&size=20')).toBe(true)

    // 45개 → 3페이지
    fireEvent.click(within(screen.getByRole('navigation', { name: '페이지' })).getByRole('button', { name: '3' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?page=3&size=20')).toBe(true))
  })

  it('카테고리로 걸러 볼 수 있다', async () => {
    const fetchMock = mockApi([ME, CATEGORIES, { path: '/api/posts', body: { items: [], page: 1, size: 20, total: 0 } }])
    renderAt('/admin/posts')
    expect(await screen.findByText('아직 글이 없습니다.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('카테고리'), { target: { value: '3' } })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => url === '/api/posts?page=1&size=20&category_id=3')).toBe(true),
    )
  })

  // TC-ADM-007, TC-POST-007: 확인 창에 함께 삭제되는 것을 안내
  it('삭제 확인 창에서 사진·댓글·좋아요도 삭제된다고 알리고, 확인하면 삭제한다', async () => {
    const fetchMock = mockApi([
      ME,
      CATEGORIES,
      { path: '/api/posts', body: { items: [summary(1, '첫 글')], page: 1, size: 20, total: 1 } },
      { method: 'DELETE', path: '/api/posts', status: 204 },
    ])
    renderAt('/admin/posts')
    fireEvent.click(await screen.findByRole('button', { name: '첫 글 삭제' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent("'첫 글' 글과 사진, 댓글, 좋아요가 모두 삭제됩니다.")

    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await screen.findByRole('status')).toHaveTextContent("'첫 글' 글을 삭제했습니다.")
    expect(sentBodies(fetchMock, 'DELETE', '/api/posts/1')).toHaveLength(1)
  })
})
