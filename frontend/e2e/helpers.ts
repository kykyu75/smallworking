// E2E 공통 도구 — 관리자 계정은 backend/tests/e2e_server.py와 같아야 한다
import { expect, request, type APIRequestContext, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export const BASE = 'http://localhost:5174'
export const ADMIN = { username: 'e2e-admin', password: 'e2e-password-1234' }
export const PHOTO_PATH = path.join(import.meta.dirname, 'fixtures', 'photo.jpg')

/** 테스트마다 겹치지 않는 이름 */
export function unique(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`
}

export async function loginInBrowser(page: Page): Promise<void> {
  await page.goto('/admin/login')
  await page.getByLabel('아이디').fill(ADMIN.username)
  await page.getByLabel('비밀번호').fill(ADMIN.password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible()
}

/** 화면을 거치지 않고 API로 데이터를 준비하는 관리자 클라이언트 (같은 사이트 Origin 포함) */
export async function adminApi(): Promise<APIRequestContext> {
  const api = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Origin: BASE } })
  const response = await api.post('/api/admin/login', { data: ADMIN })
  expect(response.status()).toBe(200)
  return api
}

export async function categoryIdByName(api: APIRequestContext, name: string): Promise<number> {
  const { items } = await (await api.get('/api/categories')).json()
  const found = items.find((c: { name: string }) => c.name === name)
  if (!found) throw new Error(`카테고리 없음: ${name}`)
  return found.id
}

export async function uploadImage(api: APIRequestContext): Promise<{ id: number; url: string }> {
  const response = await api.post('/api/images', {
    multipart: { file: { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync(PHOTO_PATH) } },
  })
  expect(response.status()).toBe(201)
  return response.json()
}

export interface CreatedPost {
  id: number
  title: string
}

/** 문단 + (선택) 이미지 + 문단 구조의 글을 API로 만든다 */
export async function createPost(
  api: APIRequestContext,
  opts: { title: string; category?: string; text?: string; withImage?: boolean },
): Promise<CreatedPost> {
  const content: unknown[] = [{ type: 'paragraph', content: [{ type: 'text', text: opts.text ?? '본문 첫 문단' }] }]
  if (opts.withImage) {
    const image = await uploadImage(api)
    content.push({ type: 'image', attrs: { imageId: image.id } })
    content.push({ type: 'paragraph', content: [{ type: 'text', text: '사진 아래 문단' }] })
  }
  const response = await api.post('/api/posts', {
    data: {
      category_id: await categoryIdByName(api, opts.category ?? 'DIY'),
      title: opts.title,
      content: { type: 'doc', content },
    },
  })
  expect(response.status()).toBe(201)
  return response.json()
}

/** 가로 스크롤이 생겼는가 (REQ-036, TC-RES-001) */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `가로로 ${overflow}px 넘침: ${page.url()}`).toBeLessThanOrEqual(0)
}
