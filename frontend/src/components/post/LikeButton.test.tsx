import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockApi } from '../../test/mockApi'
import LikeButton from './LikeButton'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('LikeButton (COMP-033)', () => {
  // TC-LIKE-009: 좋아요 → 취소 토글, 서버 응답 값으로 표시
  it('누르면 좋아요, 다시 누르면 취소된다', async () => {
    const fetchMock = mockApi([
      { method: 'POST', path: '/api/posts/7/like', body: { post_id: 7, like_count: 13, liked: true } },
      { method: 'DELETE', path: '/api/posts/7/like', body: { post_id: 7, like_count: 12, liked: false } },
    ])
    render(<LikeButton postId={7} initialCount={12} initialLiked={false} />)

    fireEvent.click(screen.getByRole('button', { name: '좋아요 (현재 12)' }))
    const liked = await screen.findByRole('button', { name: '좋아요 취소 (현재 13)' })
    await waitFor(() => expect(liked).toBeEnabled())
    expect(liked).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(liked)
    const unliked = await screen.findByRole('button', { name: '좋아요 (현재 12)' })
    await waitFor(() => expect(unliked).toBeEnabled())
    expect(unliked).toHaveAttribute('aria-pressed', 'false')

    const methods = fetchMock.mock.calls.map(([url, init]) => `${init?.method} ${url}`)
    expect(methods).toEqual(['POST /api/posts/7/like', 'DELETE /api/posts/7/like'])
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe('include') // 방문자 쿠키 전송
  })

  // TC-LIKE-010: 이미 누른 글은 눌린 상태로 시작
  it('이미 좋아요한 글은 눌린 상태로 보여준다', () => {
    mockApi([])
    render(<LikeButton postId={7} initialCount={5} initialLiked />)
    expect(screen.getByRole('button', { name: '좋아요 취소 (현재 5)' })).toHaveAttribute('aria-pressed', 'true')
  })

  // TC-LIKE-006: 처리 중에는 버튼을 막아 연속 클릭을 무시
  it('요청 처리 중에는 버튼이 막혀 연속 클릭이 한 번만 전송된다', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const fetchMock = vi.fn(async () => {
      await gate
      return new Response(JSON.stringify({ post_id: 7, like_count: 13, liked: true }), { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<LikeButton postId={7} initialCount={12} initialLiked={false} />)

    const button = screen.getByRole('button')
    fireEvent.click(button)
    fireEvent.click(button)
    fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('13') // 누르는 즉시 반영

    release()
    await waitFor(() => expect(button).toBeEnabled())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('실패하면 원래 상태로 되돌리고 안내한다', async () => {
    mockApi([
      {
        method: 'POST',
        path: '/api/posts/7/like',
        status: 404,
        body: { error: { code: 'POST_NOT_FOUND', message: '게시글을 찾을 수 없습니다.', details: null } },
      },
    ])
    render(<LikeButton postId={7} initialCount={12} initialLiked={false} />)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('게시글을 찾을 수 없습니다.')
    expect(screen.getByRole('button', { name: '좋아요 (현재 12)' })).toHaveAttribute('aria-pressed', 'false')
  })
})
