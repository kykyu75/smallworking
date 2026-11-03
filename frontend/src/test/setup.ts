import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// findBy*/waitFor 기본 대기 시간 1초 → 3초.
// 에디터 화면은 지연 로딩(TipTap)이라 PC가 바쁠 때 첫 테스트에서 1초를 넘길 수 있다 (간헐 실패 방지).
configure({ asyncUtilTimeout: 3000 })

// jsdom에는 화면 배치 API가 없다. TipTap(ProseMirror)이 커서 위치를 계산할 때 쓰므로 빈 값으로 채운다 (테스트 전용).
function emptyRects(): DOMRectList {
  const list = [] as unknown as DOMRectList
  Object.assign(list, { item: () => null })
  return list
}

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = emptyRects
}
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}

afterEach(() => {
  cleanup()
})
