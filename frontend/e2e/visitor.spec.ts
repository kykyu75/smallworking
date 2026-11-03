// TC-INT-001 방문자 시나리오 — 회원가입·로그인 없이 읽고, 좋아요하고, 댓글·답글을 단다
import { expect, test, type Page } from '@playwright/test'
import { adminApi, createPost, unique, type CreatedPost } from './helpers'

let post: CreatedPost

test.beforeAll(async () => {
  const api = await adminApi()
  post = await createPost(api, { title: unique('타일 시공'), text: '타일을 붙였다.', withImage: true })
  await api.dispose()
})

async function writeComment(page: Page, nickname: string, password: string, content: string, formName = '댓글 쓰기') {
  const form = page.getByRole('form', { name: formName })
  await form.getByLabel('닉네임').fill(nickname)
  await form.getByLabel('비밀번호').fill(password)
  await form.getByLabel(formName === '댓글 쓰기' ? '댓글 내용' : '답글 내용').fill(content)
  await form.getByRole('button', { name: formName === '댓글 쓰기' ? '댓글 등록' : '답글 등록' }).click()
}

test('방문자: 홈 → 글 → 좋아요 토글 → 댓글 → 다른 방문자 답글 → 수정 → 삭제', async ({ page, browser }) => {
  // 1. 홈에서 글 찾기 (TC-HOME-001, TC-HOME-008)
  await page.goto('/')
  await page.getByRole('region', { name: '🆕 최신 글' }).getByRole('link', { name: new RegExp(post.title) }).click()
  await expect(page.getByRole('heading', { level: 1, name: post.title })).toBeVisible()
  await expect(page.locator('.post-content img')).toBeVisible()

  // 2. 좋아요 → 취소 → 좋아요, 새로고침해도 눌린 상태 (TC-LIKE-009, TC-LIKE-010)
  await page.getByRole('button', { name: '좋아요 (현재 0)' }).click()
  await expect(page.getByRole('button', { name: '좋아요 취소 (현재 1)' })).toBeEnabled()
  await page.getByRole('button', { name: '좋아요 취소 (현재 1)' }).click()
  await expect(page.getByRole('button', { name: '좋아요 (현재 0)' })).toBeEnabled()
  await page.getByRole('button', { name: '좋아요 (현재 0)' }).click()
  await expect(page.getByRole('button', { name: '좋아요 취소 (현재 1)' })).toBeEnabled()
  await page.reload()
  await expect(page.getByRole('button', { name: '좋아요 취소 (현재 1)' })).toHaveAttribute('aria-pressed', 'true')

  // 3. 댓글 작성 (TC-COM-001)
  await writeComment(page, '작업자', 'pass1234', '멋지네요.\n어디서 샀나요?')
  const comments = page.getByRole('list', { name: '댓글 목록' })
  await expect(comments).toContainText('멋지네요.')
  await expect(page.getByRole('heading', { name: '💬 댓글 1' })).toBeVisible()

  // 4. 다른 방문자(새 브라우저)가 답글, 좋아요는 따로 센다 (TC-COM-006, TC-LIKE-011)
  const other = await browser.newContext()
  const otherPage = await other.newPage()
  await otherPage.goto(`/posts/${post.id}`)
  await otherPage.getByRole('button', { name: '좋아요 (현재 1)' }).click()
  await expect(otherPage.getByRole('button', { name: '좋아요 취소 (현재 2)' })).toBeEnabled()
  const top = otherPage.getByRole('list', { name: '댓글 목록' }).getByRole('listitem').first()
  await top.getByRole('button', { name: '답글' }).click()
  await writeComment(otherPage, '다른방문자', 'other99', '저도 궁금해요', '답글 쓰기')
  await expect(otherPage.getByRole('list', { name: '답글 목록' })).toContainText('저도 궁금해요')
  // 답글에는 [답글] 버튼이 없다 (TC-COM-008)
  await expect(otherPage.getByRole('list', { name: '답글 목록' }).getByRole('button', { name: '답글' })).toHaveCount(0)
  await other.close()

  // 5. 내 댓글 수정 — 틀린 비밀번호는 거부, 맞으면 저장 (TC-COM-011, TC-COM-010)
  await page.reload()
  const mine = page.getByText('멋지네요.', { exact: false }).locator('..')
  await mine.getByRole('button', { name: '수정' }).click()
  const editForm = page.getByRole('form', { name: '댓글 수정' })
  await editForm.getByLabel('수정할 내용').fill('정말 멋지네요!')
  await editForm.getByLabel('비밀번호').fill('wrong-pw')
  await editForm.getByRole('button', { name: '저장' }).click()
  await expect(editForm.getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.')
  await editForm.getByLabel('비밀번호').fill('pass1234')
  await editForm.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText('정말 멋지네요!')).toBeVisible()
  await expect(page.getByText('(수정됨)')).toBeVisible()

  // 6. 답글이 달린 내 댓글 삭제 → "삭제된 댓글입니다", 답글은 남는다 (TC-COM-014)
  await page.getByText('정말 멋지네요!').locator('..').getByRole('button', { name: '삭제' }).click()
  const dialog = page.getByRole('dialog', { name: '댓글 삭제' })
  await expect(dialog).toContainText('답글은 남습니다')
  await dialog.getByLabel('비밀번호').fill('pass1234')
  await dialog.getByRole('button', { name: '삭제' }).click()
  await expect(page.getByText('삭제된 댓글입니다')).toBeVisible()
  await expect(page.getByText('저도 궁금해요')).toBeVisible()
  await expect(page.getByRole('heading', { name: '💬 댓글 1' })).toBeVisible()
})

test('카테고리 목록: 페이지 주소가 남고 새로고침해도 유지된다 (TC-POST-016)', async ({ page }) => {
  const api = await adminApi()
  for (let i = 0; i < 13; i++) await createPost(api, { title: unique(`페이지${i}`), category: 'Board' })
  await api.dispose()

  await page.goto('/')
  await page.getByRole('navigation', { name: '카테고리' }).getByRole('link', { name: 'Board' }).click()
  await page.getByRole('navigation', { name: '페이지' }).getByRole('button', { name: '2' }).click()
  await expect(page).toHaveURL(/\/category\/\d+\?page=2$/)
  await page.reload()
  await expect(page.getByRole('navigation', { name: '페이지' }).getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
  await page.goBack()
  await expect(page).not.toHaveURL(/page=2/)
})
