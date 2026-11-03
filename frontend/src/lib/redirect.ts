/** 로그인 후 이동할 주소. 외부 사이트로 보내지 않도록 /admin으로 시작하는 경로만 허용한다. */
export function safeRedirect(value: string | null): string {
  if (value && value.startsWith('/admin') && !value.startsWith('//') && !value.startsWith('/admin/login')) {
    return value
  }
  return '/admin'
}
