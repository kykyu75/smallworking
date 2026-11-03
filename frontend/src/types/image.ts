// 이미지 타입 (API_SPEC v1.0 §4.2, COMPONENT_SPEC §11)
export interface PostImage {
  id: number
  url: string
  thumbnail_url: string
  original_name: string | null
  mime_type: string
  file_size: number
  width: number
  height: number
}
