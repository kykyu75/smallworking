import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { DEFAULT_CATEGORIES, EMPTY_HOME, mockApi } from './test/mockApi'

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

describe('공개 화면 기본 구조', () => {
  it('홈 화면에 사이트 이름을 표시한다', async () => {
    mockApi([{ path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }, { path: '/api/home', body: EMPTY_HOME }, { path: '/api/posts', body: { items: [], page: 1, size: 12, total: 0 } }])
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'SmallWorking' })).toBeInTheDocument()
    await screen.findAllByRole('link', { name: 'DIY' })
  })

  // TC-CAT-011 / TC-POST-014의 기반: 없는 경로는 NotFoundPage
  it('없는 경로는 404 안내와 홈으로 링크를 표시한다', async () => {
    mockApi([{ path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }, { path: '/api/home', body: EMPTY_HOME }, { path: '/api/posts', body: { items: [], page: 1, size: 12, total: 0 } }])
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
    await screen.findAllByRole('link', { name: 'DIY' })
  })
})

describe('카테고리 메뉴 (COMP-002~004)', () => {
  // TC-CAT-010: API에서 받은 카테고리가 순서대로 메뉴에 나온다 (코드 수정 없이 자동 반영)
  it('카테고리를 API 순서대로 메뉴에 표시하고 카테고리 화면으로 연결한다', async () => {
    const withTravel = [...DEFAULT_CATEGORIES, { id: 9, name: '여행', description: null, display_order: 5, post_count: 0 }]
    mockApi([{ path: '/api/categories', body: { items: withTravel } }, { path: '/api/home', body: EMPTY_HOME }])
    renderAt('/')
    const desktopMenu = await screen.findByRole('navigation', { name: '카테고리' })
    const links = within(desktopMenu).getAllByRole('link')
    // 카테고리 뒤에 고정 메뉴 "요청하기" (COMP-006, DEC-011)
    expect(links.map((a) => a.textContent)).toEqual(['DIY', 'Portfolio', 'Blog', 'Board', '여행', '요청하기'])
    expect(links[4]).toHaveAttribute('href', '/category/9')
    expect(links[5]).toHaveAttribute('href', '/requests')
  })

  // TC-RES-002: 모바일 메뉴 열기/닫기, 이동하면 닫힘
  it('모바일 메뉴를 열고, 카테고리를 누르면 이동하면서 닫힌다', async () => {
    mockApi([{ path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }, { path: '/api/home', body: EMPTY_HOME }, { path: '/api/posts', body: { items: [], page: 1, size: 12, total: 0 } }])
    renderAt('/')
    const toggle = await screen.findByRole('button', { name: '메뉴 열기' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: '메뉴 닫기' })).toHaveAttribute('aria-expanded', 'true')
    const mobileNav = document.getElementById('mobile-menu')!
    fireEvent.click(within(mobileNav).getByRole('link', { name: 'Blog' }))

    expect(await screen.findByRole('heading', { name: 'Blog' })).toBeInTheDocument()
    expect(document.getElementById('mobile-menu')).toBeNull()
  })

  // TC-CAT-011: 없는 카테고리
  it('없는 카테고리 주소는 404 안내를 보여준다', async () => {
    mockApi([{ path: '/api/categories', body: { items: DEFAULT_CATEGORIES } }, { path: '/api/home', body: EMPTY_HOME }, { path: '/api/posts', body: { items: [], page: 1, size: 12, total: 0 } }])
    renderAt('/category/9999')
    expect(await screen.findByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
  })
})
