// 관리자 인증 타입 (API-023~025)

export interface AdminMe {
  username: string
}

export interface LoginInput {
  username: string
  password: string
}
