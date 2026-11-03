import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import App from './App'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App 라우팅 (M0 뼈대)', () => {
  it('홈 화면에 사이트 이름을 표시한다', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { name: 'SmallWorking' })).toBeInTheDocument()
  })

  // TC-CAT-011 / TC-POST-014의 기반: 없는 경로는 NotFoundPage
  it('없는 경로는 404 안내와 홈으로 링크를 표시한다', () => {
    renderAt('/no-such-page')
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '홈으로' })).toHaveAttribute('href', '/')
  })
})
