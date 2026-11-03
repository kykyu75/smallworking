// TC-INT-002 운영자 시나리오 — 실제 브라우저에서 TipTap 에디터에 타이핑하고 사진을 넣는다
import { expect, test } from '@playwright/test'
import { PHOTO_PATH, loginInBrowser, unique } from './helpers'

test('운영자: 카테고리 추가 → 사진이 본문 중간에 있는 글 작성 → 공개 화면 확인 → 수정 → 정리', async ({ page }) => {
  const category = unique('여행')
  const title = unique('제주 여행기')

  // 1. 로그인 (TC-ADM-001)
  await loginInBrowser(page)

  // 2. 카테고리 추가 — 맨 뒤에 붙는다 (TC-CAT-003)
  await page.getByRole('link', { name: '카테고리', exact: true }).click()
  await page.getByLabel(/^이름/).first().fill(category)
  await page.getByRole('button', { name: '추가' }).click()
  await expect(page.getByText(`'${category}' 카테고리를 추가했습니다.`)).toBeVisible()
  const rows = page.getByRole('list', { name: '카테고리 목록' }).getByRole('listitem')
  await expect(rows.last()).toContainText(category)

  // 3. 새 글 쓰기: 실제 키보드 입력 + 서식 + 사진 (TC-POST-001, TC-IMG-003, TC-IMG-013)
  await page.getByRole('link', { name: '게시글', exact: true }).click()
  await page.getByRole('link', { name: '새 글 쓰기' }).click()
  await page.getByLabel('카테고리').selectOption({ label: category })
  await page.getByLabel(/^제목 \(/).fill(title)

  const editor = page.getByRole('textbox', { name: '본문' })
  await editor.click()
  await page.keyboard.type('첫날은 바다를 봤다.')
  await page.keyboard.press('Enter')

  await page.getByTestId('image-file-input').setInputFiles(PHOTO_PATH)
  await expect(editor.locator('img[data-image-id]')).toHaveCount(1)
  await expect(page.getByText('이미지 1 / 20')).toBeVisible()

  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '굵게' }).click()
  await page.keyboard.type('정말 좋았다')
  await page.getByRole('button', { name: '굵게' }).click()

  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`'${title}' 글을 저장했습니다.`)).toBeVisible()

  // 4. 공개 홈: 새 카테고리 섹션과 최신 글에 나온다 (TC-HOME-005, TC-HOME-003)
  await page.goto('/')
  const section = page.getByRole('region', { name: category })
  await expect(section.getByRole('link', { name: new RegExp(title) })).toBeVisible()
  await expect(page.getByRole('region', { name: '🆕 최신 글' }).getByRole('link', { name: new RegExp(title) })).toBeVisible()

  // 5. 상세: 문단 → 사진 → 굵은 글 순서, 사진은 1920px로 줄어 저장 (TC-POST-009, TC-IMG-013)
  await section.getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  const blocks = page.locator('.post-content > *')
  await expect(blocks.nth(0)).toHaveText('첫날은 바다를 봤다.')
  await expect(blocks.nth(1).locator('img')).toBeVisible()
  await expect(page.locator('.post-content strong')).toHaveText('정말 좋았다')
  const natural = await blocks.nth(1).locator('img').evaluate((img: HTMLImageElement) => [img.naturalWidth, img.naturalHeight])
  expect(natural).toEqual([1920, 1280])
  const postUrl = page.url()

  // 6. 수정: 제목 변경 → (수정됨) (TC-POST-005)
  await page.goto('/admin/posts')
  const row = page.getByRole('list', { name: '게시글 목록' }).getByRole('listitem').filter({ hasText: title })
  await row.getByRole('link', { name: '수정' }).click()
  const titleInput = page.getByLabel(/^제목 \(/)
  await expect(titleInput).toHaveValue(title)
  await titleInput.fill(`${title} (후기)`)
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`'${title} (후기)' 글을 저장했습니다.`)).toBeVisible()
  await page.goto(postUrl)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${title} (후기)`)

  // 7. 글이 있는 카테고리는 삭제 불가 (TC-CAT-008, TC-CAT-014)
  await page.goto('/admin/categories')
  await expect(page.getByRole('button', { name: `${category} 삭제` })).toBeDisabled()

  // 8. 글 삭제 → 카테고리 삭제 (TC-POST-007, TC-CAT-007)
  await page.goto('/admin/posts')
  await page.getByRole('button', { name: `${title} (후기) 삭제` }).click()
  await expect(page.getByRole('dialog')).toContainText('사진, 댓글, 좋아요가 모두 삭제됩니다')
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText(`'${title} (후기)' 글을 삭제했습니다.`)).toBeVisible()

  await page.goto('/admin/categories')
  await page.getByRole('button', { name: `${category} 삭제` }).click()
  await page.getByRole('dialog').getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText(`'${category}' 카테고리를 삭제했습니다.`)).toBeVisible()

  // 9. 로그아웃 → 관리자 화면은 로그인 화면으로 (TC-ADM-005, TC-ADM-003)
  await page.getByRole('button', { name: '로그아웃' }).click()
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()
  await page.goto('/admin/posts')
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fposts/)
})

test('저장하지 않고 메뉴로 나가려 하면 확인한다 (TC-ADM-008)', async ({ page }) => {
  await loginInBrowser(page)
  await page.goto('/admin/posts/new')
  await page.getByLabel(/^제목 \(/).fill('쓰다 만 글')

  let asked = ''
  page.once('dialog', async (dialog) => {
    asked = dialog.message()
    await dialog.dismiss() // 머물기
  })
  await page.getByRole('link', { name: '대시보드' }).click()
  expect(asked).toContain('저장하지 않은 내용이 있습니다')
  await expect(page).toHaveURL(/\/admin\/posts\/new$/)
})
