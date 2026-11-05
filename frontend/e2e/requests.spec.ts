// TC-REQ-020 요청 게시판 시나리오 (DEC-011)
// 방문자 A가 비밀글로 요청 → 방문자 B는 제목도 못 봄 → 비밀번호로 열람 → 운영자 답변 → 작성자 화면에 답변·수정 불가
import { expect, test } from '@playwright/test'
import { adminApi, expectNoHorizontalScroll, loginInBrowser, unique } from './helpers'

test('요청 게시판: 비밀글 작성 → 다른 방문자 열람 → 운영자 답변 → 휴대폰 화면 (TC-REQ-020)', async ({ page, browser }) => {
  const title = unique('도면 요청')
  const password = 'secret-1234'

  // 1. 방문자 A: 메뉴 "쥔장에게 묻기" → 요청 남기기 (비밀글)
  await page.goto('/')
  await page.getByRole('navigation', { name: '카테고리' }).getByRole('link', { name: '쥔장에게 묻기' }).click()
  await expect(page.getByRole('heading', { level: 1, name: '쥔장에게 묻기' })).toBeVisible()
  await page.getByRole('link', { name: '요청 남기기' }).click()

  const form = page.getByRole('form', { name: '요청 작성' })
  await form.getByText('DIY 요청').click()
  await form.getByLabel(/^제목/).fill(title)
  await form.getByLabel('내용').fill('원목 선반 도면을\n공유해 주실 수 있나요?')
  await form.getByLabel(/^닉네임/).fill('목수지망생')
  await form.getByLabel(/^비밀번호/).fill(password)
  await form.getByLabel(/^비밀글/).check()
  await form.getByRole('button', { name: '요청 등록' }).click()

  // 작성 직후에는 비밀번호 없이 바로 보인다
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  await expect(page.getByText('공유해 주실 수 있나요?')).toBeVisible()
  const requestUrl = page.url()
  const requestId = Number(new URL(requestUrl).pathname.split('/').pop())

  // 2. 방문자 B: 목록에서 제목이 가려지고, 상세는 비밀번호를 물어본다
  const other = await browser.newContext()
  const visitor = await other.newPage()
  await visitor.goto('/requests')
  const list = visitor.getByRole('list', { name: '요청 목록' })
  await expect(list.getByText(title)).toHaveCount(0)
  await expect(list.getByRole('link').first()).toContainText('🔒 비밀글입니다')
  await visitor.goto(requestUrl)
  const unlock = visitor.getByRole('form', { name: '비밀글 열기' })
  await unlock.getByLabel('비밀번호').fill('wrong-pass')
  await unlock.getByRole('button', { name: '열기' }).click()
  await expect(unlock.getByRole('alert')).toHaveText('비밀번호가 일치하지 않습니다.')
  await unlock.getByLabel('비밀번호').fill(password)
  await unlock.getByRole('button', { name: '열기' }).click()
  await expect(visitor.getByRole('heading', { level: 1, name: title })).toBeVisible()

  // 3. 운영자: 대시보드 "새 요청" → 요청 관리에서 비밀글 내용 확인 후 답변
  await loginInBrowser(page)
  await expect(page.getByRole('link', { name: /새 요청 \d+건/ })).toBeVisible()
  await page.getByRole('navigation', { name: '관리자 메뉴' }).getByRole('link', { name: '요청' }).click()
  const answerForm = page.getByRole('form', { name: `요청 ${requestId} 답변` })
  await expect(page.getByText('원목 선반 도면을')).toBeVisible()
  await answerForm.getByLabel('답변').fill('다음 주에 도면을 올려 드릴게요.')
  await answerForm.getByRole('button', { name: '답변 저장' }).click()
  await expect(page.getByRole('status')).toHaveText('답변을 저장했습니다.')

  // 4. 작성자(방문자 B 화면, 비밀번호로 다시 열기): 답변이 보이고 수정은 막힌다
  await visitor.reload()
  await visitor.getByRole('form', { name: '비밀글 열기' }).getByLabel('비밀번호').fill(password)
  await visitor.getByRole('form', { name: '비밀글 열기' }).getByRole('button', { name: '열기' }).click()
  await expect(visitor.getByRole('region', { name: '운영자 답변' })).toContainText('다음 주에 도면을 올려 드릴게요.')
  await expect(visitor.getByText('답변이 달려 수정할 수 없습니다.')).toBeVisible()
  await expect(visitor.getByRole('button', { name: '수정' })).toHaveCount(0)

  // 5. 휴대폰 폭: 목록·상세 가로 스크롤 없음, 햄버거 메뉴에도 "쥔장에게 묻기"
  await visitor.setViewportSize({ width: 360, height: 800 })
  await expectNoHorizontalScroll(visitor)
  await visitor.goto('/requests')
  await expectNoHorizontalScroll(visitor)
  await visitor.getByRole('button', { name: '메뉴 열기' }).click()
  await expect(visitor.locator('#mobile-menu').getByRole('link', { name: '쥔장에게 묻기' })).toBeVisible()
  await other.close()

  const api = await adminApi()
  expect((await api.delete(`/api/admin/requests/${requestId}`)).status()).toBe(204)
})
