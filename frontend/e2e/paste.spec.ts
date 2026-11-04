// DEC-009 Markdown 원문·HTML 소스 붙여넣기 → 저장 → 공개 화면 (TC-POST-020, TC-POST-021)
// 실제 클립보드에 글을 넣고 Ctrl+V로 붙여 넣는다.
import { expect, test, type Page } from '@playwright/test'
import { adminApi, expectNoHorizontalScroll, loginInBrowser, unique } from './helpers'

test.use({ permissions: ['clipboard-read', 'clipboard-write'] })

async function pasteText(page: Page, text: string) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text)
  await page.keyboard.press('ControlOrMeta+V')
}

async function writePost(page: Page, title: string, clipboard: string): Promise<number> {
  await page.goto('/admin/posts/new')
  await page.getByLabel('카테고리').selectOption({ label: 'Blog' })
  await page.getByLabel(/^제목 \(/).fill(title)
  await page.getByRole('textbox', { name: '본문' }).click()
  await pasteText(page, clipboard)
  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`'${title}' 글을 저장했습니다.`)).toBeVisible()

  await page.goto('/')
  await page.getByRole('region', { name: '🆕 최신 글' }).getByRole('link', { name: new RegExp(title) }).click()
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
  return Number(new URL(page.url()).pathname.split('/').pop())
}

test('Markdown 원문을 붙여 넣으면 제목·목록·굵게·링크·코드블록으로 저장된다 (TC-POST-020)', async ({ page }) => {
  await loginInBrowser(page)
  const title = unique('마크다운')
  const markdown = [
    '# 준비물',
    '',
    '오늘은 **원목 선반**을 만들었다. [참고 영상](https://example.com/video)',
    '',
    '- 원목 2장',
    '- 나사 8개',
    '',
    '1. 재단',
    '2. 조립',
    '',
    '> 치수는 두 번 재자',
    '',
    '```python',
    'print("done")',
    '```',
  ].join('\n')
  const postId = await writePost(page, title, markdown)

  const body = page.locator('.post-content')
  await expect(body.getByRole('heading', { level: 2, name: '준비물' })).toBeVisible()
  await expect(body.locator('strong')).toHaveText('원목 선반')
  await expect(body.getByRole('link', { name: '참고 영상' })).toHaveAttribute('href', 'https://example.com/video')
  await expect(body.locator('ul > li')).toHaveText(['원목 2장', '나사 8개'])
  await expect(body.locator('ol > li')).toHaveText(['재단', '조립'])
  await expect(body.locator('blockquote')).toHaveText('치수는 두 번 재자')
  await expect(body.locator('pre')).toContainText('print("done")')
  await expect(body).not.toContainText('**')

  const api = await adminApi()
  expect((await api.delete(`/api/posts/${postId}`)).status()).toBe(204)
})

test('HTML 소스를 붙여 넣으면 서식으로 저장되고 위험한 요소는 사라진다 (TC-POST-021)', async ({ page }) => {
  await loginInBrowser(page)
  const title = unique('HTML소스')
  const html =
    '<h1>공지</h1><p>안녕하세요 <strong>방문자</strong>님 <a href="javascript:alert(1)">나쁜 링크</a></p>' +
    '<img src="https://example.com/x.png" onerror="alert(1)"><script>alert(1)</script><ul><li>항목</li></ul>'
  const dialogs: string[] = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  const postId = await writePost(page, title, html)

  const body = page.locator('.post-content')
  await expect(body.getByRole('heading', { level: 2, name: '공지' })).toBeVisible()
  await expect(body.locator('strong')).toHaveText('방문자')
  await expect(body.locator('li')).toHaveText(['항목'])
  await expect(body.locator('a')).toHaveCount(0)
  await expect(body.locator('img, script')).toHaveCount(0)
  await expect(body).not.toContainText('<')
  expect(dialogs).toEqual([])

  const api = await adminApi()
  expect((await api.delete(`/api/posts/${postId}`)).status()).toBe(204)
})

test('Markdown 표를 붙여 넣으면 표로 저장되고, 휴대폰 폭에서는 표 안에서만 가로로 밀린다 (TC-POST-027, TC-POST-029, TC-RES-012)', async ({ page }) => {
  await loginInBrowser(page)
  const title = unique('표')
  const markdown = [
    '| 재료 | 규격 | 수량 | 구입처 | 비고 |',
    '|---|---|---:|---|---|',
    '| **원목** | 1800×300×18mm 집성목 | 2 | 동네목재상회 | 모서리 라운드 가공 요청 |',
    '| 나사 | 4×35mm 피스 | 8 | 철물점 | 여유분 포함 |',
  ].join('\n')
  const postId = await writePost(page, title, markdown)

  const body = page.locator('.post-content')
  await expect(body.locator('th')).toHaveText(['재료', '규격', '수량', '구입처', '비고'])
  await expect(body.locator('tr').nth(1).locator('td').first()).toHaveText('원목')
  await expect(body.locator('tr').nth(1).locator('td strong')).toHaveText('원목')
  await expect(body.locator('td').nth(2)).toHaveClass(/text-right/)

  await page.setViewportSize({ width: 360, height: 800 })
  await page.reload()
  const scroller = page.getByRole('region', { name: '표' })
  await expect(scroller).toBeVisible()
  await expectNoHorizontalScroll(page)
  const [scrollWidth, clientWidth] = await scroller.evaluate((el) => [el.scrollWidth, el.clientWidth])
  expect(scrollWidth).toBeGreaterThan(clientWidth) // 표 상자 안에서만 가로 스크롤

  const api = await adminApi()
  expect((await api.delete(`/api/posts/${postId}`)).status()).toBe(204)
})

test('에디터 [표 넣기]로 표를 만들고 행을 추가해 저장한다 (TC-POST-028)', async ({ page }) => {
  await loginInBrowser(page)
  const title = unique('표버튼')
  await page.goto('/admin/posts/new')
  await page.getByLabel('카테고리').selectOption({ label: 'Blog' })
  await page.getByLabel(/^제목 \(/).fill(title)
  const editor = page.getByRole('textbox', { name: '본문' })
  await editor.click()
  await page.getByRole('button', { name: '표 넣기' }).click()
  await expect(editor.locator('table tr')).toHaveCount(3)

  await page.keyboard.type('항목') // 첫 칸(제목 칸)
  await page.keyboard.press('Tab')
  await page.keyboard.type('값')
  await page.getByRole('group', { name: '표 편집' }).getByRole('button', { name: '아래에 행 추가' }).click()
  await expect(editor.locator('table tr')).toHaveCount(4)

  await page.getByRole('button', { name: '저장' }).click()
  await expect(page.getByText(`'${title}' 글을 저장했습니다.`)).toBeVisible()

  await page.goto('/')
  await page.getByRole('region', { name: '🆕 최신 글' }).getByRole('link', { name: new RegExp(title) }).click()
  const table = page.locator('.post-content table')
  await expect(table.locator('tr')).toHaveCount(4)
  await expect(table.locator('th').nth(0)).toHaveText('항목')
  await expect(table.locator('th').nth(1)).toHaveText('값')

  const postId = Number(new URL(page.url()).pathname.split('/').pop())
  const api = await adminApi()
  expect((await api.delete(`/api/posts/${postId}`)).status()).toBe(204)
})