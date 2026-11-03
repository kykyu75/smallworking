import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { mockApi, sentBodies, type MockRoute } from '../../test/mockApi'

const ME: MockRoute = { path: '/api/admin/me', body: { username: 'admin' } }

const ITEMS = [
  { id: 8, post_id: 7, post_title: '주방 타일 시공', parent_comment_id: 3, nickname: '답글러', content: '동의합니다', reply_count: 0, created_at: '2026-11-03T10:00:00Z' },
  { id: 3, post_id: 7, post_title: '주방 타일 시공', parent_comment_id: null, nickname: '광고봇', content: '싸게 팝니다', reply_count: 1, created_at: '2026-11-03T09:00:00Z' },
]

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/comments']}>
      <App />
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('댓글 관리 화면 (COMP-140, 141)', () => {
  // TC-ADM-009
  it('댓글·답글 목록을 게시글 링크·구분·답글 수와 함께 20개씩 보여준다', async () => {
    const fetchMock = mockApi([ME, { path: '/api/admin/comments', body: { items: ITEMS, page: 1, size: 20, total: 2 } }])
    renderPage()
    const list = await screen.findByRole('list', { name: '댓글 목록' })
    const [first, second] = within(list).getAllByRole('listitem')
    expect(first).toHaveTextContent('답글')
    expect(second).toHaveTextContent('답글 1')
    expect(within(second).getByRole('link', { name: '주방 타일 시공' })).toHaveAttribute('href', '/posts/7')
    expect(fetchMock.mock.calls.some(([url]) => url === '/api/admin/comments?page=1&size=20')).toBe(true)
  })

  // TC-ADM-010, TC-ADM-011: 확인 창(답글 유지 안내) → 비밀번호 없이 삭제
  it('답글이 있는 댓글 삭제는 답글이 유지된다고 안내하고, 확인하면 비밀번호 없이 삭제한다', async () => {
    const fetchMock = mockApi([
      ME,
      { path: '/api/admin/comments', body: { items: ITEMS, page: 1, size: 20, total: 2 } },
      { method: 'DELETE', path: '/api/admin/comments/3', status: 204 },
    ])
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '광고봇의 댓글 삭제' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent("답글 1개는 유지되고 '삭제된 댓글입니다'로 표시됩니다.")

    fireEvent.click(within(dialog).getByRole('button', { name: '삭제' }))
    expect(await screen.findByRole('status')).toHaveTextContent('댓글을 삭제했습니다.')
    expect(sentBodies(fetchMock, 'DELETE', '/api/admin/comments/3')).toEqual([undefined]) // 본문(비밀번호) 없음
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith('/api/admin/comments?')).length).toBe(2))
  })
})
