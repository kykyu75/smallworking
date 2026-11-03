// 업로드 전 브라우저 이미지 축소 (DEC-007, COMPONENT_SPEC §9.5, TC-IMG-010/013/025/026)
//
// | 단계 | 규칙 |
// |---|---|
// | 선택 가능 | jpg, png, webp, gif / 원본 10MB 이하 |
// | 축소 | 긴 변 1920px 초과 시 1920px로 (확대하지 않음), EXIF 회전 반영 |
// | 변환 | jpg → jpg, png·webp → webp (품질 0.85), gif → 변환 안 함 (움직임 유지) |
// | 전송 | 결과가 4MB 이하일 때만 (Vercel 요청 크기 제한) |

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const MAX_ORIGINAL_BYTES = 10 * 1024 * 1024
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
export const MAX_SIDE = 1920
export const QUALITY = 0.85

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

export const MESSAGES = {
  type: 'jpg, png, webp, gif 이미지만 올릴 수 있습니다.',
  original: '이미지는 원본 10MB까지 올릴 수 있습니다.',
  tooLarge: '이미지가 너무 큽니다. 4MB 이하로 줄여서 다시 올려 주세요.',
  decode: '이미지 파일을 읽을 수 없습니다.',
}

export function fitWithin(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= max) return { width, height }
  const ratio = max / longest
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}

/** 업로드할 형식. gif는 null(변환하지 않음). */
export function outputType(type: string): 'image/jpeg' | 'image/webp' | null {
  if (type === 'image/gif') return null
  return type === 'image/jpeg' ? 'image/jpeg' : 'image/webp'
}

function renamed(name: string, type: string): string {
  const ext = type === 'image/jpeg' ? 'jpg' : 'webp'
  const base = name.replace(/\.[^./\\]+$/, '') || 'image'
  return `${base}.${ext}`
}

export interface DecodedImage {
  width: number
  height: number
  source: CanvasImageSource
  close?: () => void
}

/** 디코딩·인코딩 방법 (테스트에서는 가짜로 바꿔 끼운다; jsdom에는 canvas가 없다). */
export interface ImageCodec {
  decode(file: File): Promise<DecodedImage>
  encode(image: DecodedImage, size: { width: number; height: number }, type: string, quality: number): Promise<Blob>
}

export const browserCodec: ImageCodec = {
  async decode(file) {
    // imageOrientation: 'from-image' → 휴대폰 사진의 회전 정보대로 바로 세운다
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { width: bitmap.width, height: bitmap.height, source: bitmap, close: () => bitmap.close() }
  },
  async encode(image, size, type, quality) {
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new ImageValidationError(MESSAGES.decode)
    context.imageSmoothingQuality = 'high'
    context.drawImage(image.source, 0, 0, size.width, size.height)
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new ImageValidationError(MESSAGES.decode))), type, quality)
    })
  },
}

/** 선택한 파일을 검사하고 필요하면 줄여서, 서버로 보낼 파일을 돌려준다. */
export async function prepareImage(file: File, codec: ImageCodec = browserCodec): Promise<File> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) throw new ImageValidationError(MESSAGES.type)
  if (file.size > MAX_ORIGINAL_BYTES) throw new ImageValidationError(MESSAGES.original)

  const target = outputType(file.type)
  if (target === null) {
    // gif: 변환하면 움직임이 사라지므로 그대로 보낸다
    if (file.size > MAX_UPLOAD_BYTES) throw new ImageValidationError(MESSAGES.tooLarge)
    return file
  }

  let decoded: DecodedImage
  try {
    decoded = await codec.decode(file)
  } catch {
    throw new ImageValidationError(MESSAGES.decode)
  }

  try {
    const size = fitWithin(decoded.width, decoded.height)
    const needsResize = size.width !== decoded.width || size.height !== decoded.height
    // 줄일 필요도, 형식을 바꿀 필요도 없으면 원본 그대로 (불필요한 화질 손실 방지)
    if (!needsResize && target === file.type && file.size <= MAX_UPLOAD_BYTES) return file

    const blob = await codec.encode(decoded, size, target, QUALITY)
    if (blob.size > MAX_UPLOAD_BYTES) throw new ImageValidationError(MESSAGES.tooLarge)
    return new File([blob], renamed(file.name, target), { type: target })
  } finally {
    decoded.close?.()
  }
}
