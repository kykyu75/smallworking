// 저장하지 않은 변경이 있을 때 화면 이동 전에 확인 (COMP-134, TC-ADM-008)
// 이 앱은 선언형 BrowserRouter를 쓰므로, 관리자 메뉴 링크와 취소 버튼에서 직접 확인한다.
let guardMessage: string | null = null

export function setLeaveGuard(message: string | null): void {
  guardMessage = message
}

/** 이동해도 되면 true. 확인이 필요하면 확인 창을 띄운다. */
export function confirmLeave(): boolean {
  return guardMessage === null || window.confirm(guardMessage)
}
