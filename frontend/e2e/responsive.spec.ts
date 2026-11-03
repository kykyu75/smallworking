// TC-RES-001~008 반응형 — 360 / 768 / 1280px에서 가로 스크롤이 없고, 배치가 바뀐다 (DEC-006, REQ-036, REQ-037)
import { expect, test, type Page } from '@playwright/test'
import { adminApi, createPost, expectNoHorizontalScroll, loginInBrowser, unique, type CreatedPost } from './helpers'

const WIDTHS = [360, 768, 1280] as const
let post: CreatedPost

test.beforeAll(async () => {
  const api = await adminApi()
  post = await createPost(api, { title: unique('반응형 확인용 아주 긴 제목이 화면 밖으로 넘치지 않는지 보는 글'), withImage: true })
  // 공백 없는 긴 URL 댓글 (TC-RES-007)
  await api.post(`/api/posts/${post.id}/comments`, {
    data: { nickname: '긴글러', password: '1234', content: `https://example.com/${'a'.repeat(300)}` },
  })
  await api.dispose()
})

function columnCount(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
}

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('공개 화면에 가로 스크롤이 없다 (TC-RES-001)', async ({ page }) => {
      for (const path of ['/', '/category/1', `/posts/${post.id}`, '/no-such-page']) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expectNoHorizontalScroll(page)
      }
    })

    test('관리자 화면에 가로 스크롤이 없다 (TC-RES-001, TC-RES-009)', async ({ page }) => {
      await loginInBrowser(page)
      for (const path of ['/admin', '/admin/categories', '/admin/posts', '/admin/posts/new', '/admin/comments', `/admin/posts/${post.id}/edit`]) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expectNoHorizontalScroll(page)
      }
    })

    test('본문 사진과 긴 URL 댓글이 화면 폭을 넘지 않는다 (TC-RES-006, TC-RES-007)', async ({ page }) => {
      await page.goto(`/posts/${post.id}`)
      const img = page.locator('.post-content img')
      await expect(img).toBeVisible()
      const box = await img.boundingBox()
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      const longComment = page.getByText(/^https:\/\/example\.com\/a+$/)
      const commentBox = await longComment.boundingBox()
      expect(commentBox!.x + commentBox!.width).toBeLessThanOrEqual(width)
    })

    test('홈 카테고리 섹션과 목록 카드의 열 수 (TC-RES-004, TC-RES-005)', async ({ page }) => {
      const expected = width < 768 ? 1 : width < 1024 ? 2 : 3
      await page.goto('/')
      await expect(page.getByRole('region', { name: 'DIY' })).toBeVisible()
      expect(await columnCount(page, 'main .grid')).toBe(expected)
      await page.goto('/category/1')
      await expect(page.getByRole('list', { name: 'DIY 게시글' })).toBeVisible()
      expect(await columnCount(page, 'ul[aria-label="DIY 게시글"]')).toBe(expected)
    })
  })
}

test.describe('메뉴 전환 (TC-RES-002, TC-RES-003)', () => {
  test('767px: 햄버거 메뉴로 열고 닫고, 카테고리로 이동하면 닫힌다', async ({ page }) => {
    await page.setViewportSize({ width: 767, height: 900 })
    await page.goto('/')
    await expect(page.locator('nav[aria-label="카테고리"]').first()).toBeHidden() // 가로 메뉴 숨김
    await page.getByRole('button', { name: '메뉴 열기' }).click()
    const drawer = page.locator('#mobile-menu')
    await expect(drawer).toBeVisible()
    await drawer.getByRole('link', { name: 'Blog' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Blog' })).toBeVisible()
    await expect(drawer).toBeHidden()
  })

  test('768px: 가로 메뉴가 보이고 햄버거는 없다', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    await page.goto('/')
    await expect(page.getByRole('navigation', { name: '카테고리' })).toBeVisible()
    await expect(page.getByRole('button', { name: '메뉴 열기' })).toBeHidden()
  })
})
