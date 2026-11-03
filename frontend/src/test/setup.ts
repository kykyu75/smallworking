import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

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
