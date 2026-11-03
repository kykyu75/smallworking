// TC-INT-004 보안 시나리오 (실제 브라우저·실제 서버)
import { expect, request, test } from '@playwright/test'
import { BASE, adminApi, createPost, unique } from './helpers'

test('로그인하지 않으면 관리자 화면은 로그인으로, 관리자 API는 401 (TC-ADM-003, TC-ADM-004)', async ({ page }) => {
  await page.goto('/admin/comments')
  await expect(page).toHaveURL(/\/admin\/login\?redirect=%2Fadmin%2Fcomments/)

  const anonymous = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } })
  const calls = [
    anonymous.get('/api/admin/me'),
    anonymous.get('/api/admin/comments'),
    anonymous.post('/api/categories', { data: { name: '몰래' } }),
    anonymous.post('/api/posts', { data: { category_id: 1, title: 'x', content: { type: 'doc', content: [] } } }),
    anonymous.delete('/api/posts/1'),
  ]
  for (const response of await Promise.all(calls)) expect(response.status()).toBe(401)
  await anonymous.dispose()
})

test('다른 사이트에서 보낸 상태 변경 요청은 403 (TC-SEC-010)', async () => {
  const api = await adminApi()
  const post = await createPost(api, { title: unique('origin') })
  const evil = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: 'https://evil.example' } })
  expect((await evil.post(`/api/posts/${post.id}/like`)).status()).toBe(403)
  expect(
    (await evil.post(`/api/posts/${post.id}/comments`, { data: { nickname: '공격자', password: '1234', content: 'x' } })).status(),
  ).toBe(403)
  await evil.dispose()
  await api.dispose()
})

test('댓글·닉네임의 스크립트는 실행되지 않고 글자로 보인다 (TC-SEC-001~003)', async ({ page }) => {
  const api = await adminApi()
  const post = await createPost(api, { title: unique('xss') })
  await api.dispose()

  const dialogs: string[] = []
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message())
    await dialog.dismiss()
  })
  await page.goto(`/posts/${post.id}`)
  const form = page.getByRole('form', { name: '댓글 쓰기' })
  await form.getByLabel('닉네임').fill('<b>해커</b>')
  await form.getByLabel('비밀번호').fill('1234')
  await form.getByLabel('댓글 내용').fill('<img src=x onerror=alert(1)><script>alert(2)</script>')
  await form.getByRole('button', { name: '댓글 등록' }).click()

  await expect(page.getByText('<img src=x onerror=alert(1)><script>alert(2)</script>')).toBeVisible()
  await expect(page.getByText('<b>해커</b>')).toBeVisible()
  await page.reload()
  await page.waitForTimeout(500)
  expect(dialogs).toEqual([])
  await expect(page.locator('.post-content img, section[aria-labelledby="comments-heading"] img')).toHaveCount(0)
})

test('세션·방문자 쿠키는 스크립트로 읽을 수 없다 (TC-SEC-013)', async ({ page, context }) => {
  const api = await adminApi()
  const post = await createPost(api, { title: unique('cookie') })
  await api.dispose()
  await page.goto(`/posts/${post.id}`)
  await page.getByRole('button', { name: /^좋아요 \(현재/ }).click()
  await expect(page.getByRole('button', { name: /^좋아요 취소/ })).toBeEnabled()

  const cookies = await context.cookies()
  const visitor = cookies.find((c) => c.name === 'sw_visitor')
  expect(visitor?.httpOnly).toBe(true)
  expect(visitor?.sameSite).toBe('Lax')
  expect(await page.evaluate(() => document.cookie)).not.toContain('sw_visitor')
})
