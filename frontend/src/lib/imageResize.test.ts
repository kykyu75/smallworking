import { describe, expect, it, vi } from 'vitest'
import {
  MAX_ORIGINAL_BYTES,
  MAX_UPLOAD_BYTES,
  MESSAGES,
  fitWithin,
  outputType,
  prepareImage,
  type ImageCodec,
} from './imageResize'

function fakeFile(name: string, type: string, size = 1000): File {
  return new File([new Uint8Array(size)], name, { type })
}

function fakeCodec(width: number, height: number, encodedSize = 500_000) {
  const encode = vi.fn(async (_image, _size, type: string) => new Blob([new Uint8Array(encodedSize)], { type }))
  const codec: ImageCodec = {
    decode: vi.fn(async () => ({ width, height, source: {} as CanvasImageSource, close: vi.fn() })),
    encode,
  }
  return { codec, encode }
}

describe('fitWithin', () => {
  it('긴 변이 1920px을 넘으면 비율을 지켜 줄이고, 작으면 그대로 둔다', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1920, height: 1440 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1440, height: 1920 })
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('outputType (DEC-007)', () => {
  it('jpg는 jpg, png·webp는 webp, gif는 변환하지 않는다', () => {
    expect(outputType('image/jpeg')).toBe('image/jpeg')
    expect(outputType('image/png')).toBe('image/webp')
    expect(outputType('image/webp')).toBe('image/webp')
    expect(outputType('image/gif')).toBeNull()
  })
})

describe('prepareImage', () => {
  // TC-IMG-009 (UI)
  it('지원하지 않는 형식은 거부한다', async () => {
    await expect(prepareImage(fakeFile('a.mp4', 'video/mp4'))).rejects.toThrow(MESSAGES.type)
    await expect(prepareImage(fakeFile('a.svg', 'image/svg+xml'))).rejects.toThrow(MESSAGES.type)
  })

  // TC-IMG-010 (UI)
  it('원본이 10MB를 넘으면 거부한다', async () => {
    await expect(prepareImage(fakeFile('big.jpg', 'image/jpeg', MAX_ORIGINAL_BYTES + 1))).rejects.toThrow(MESSAGES.original)
  })

  // TC-IMG-013 (UI): 4000×3000 → 1920×1440로 줄여 jpg로 보낸다
  it('큰 사진은 1920px로 줄인다', async () => {
    const { codec, encode } = fakeCodec(4000, 3000)
    const result = await prepareImage(fakeFile('photo.JPG', 'image/jpeg', 8_000_000), codec)
    expect(encode).toHaveBeenCalledWith(expect.anything(), { width: 1920, height: 1440 }, 'image/jpeg', 0.85)
    expect(result.type).toBe('image/jpeg')
    expect(result.name).toBe('photo.jpg')
    expect(result.size).toBe(500_000)
  })

  // TC-IMG-025: png → webp
  it('png는 webp로 바꾼다', async () => {
    const { codec, encode } = fakeCodec(800, 600)
    const result = await prepareImage(fakeFile('screen.png', 'image/png'), codec)
    expect(encode).toHaveBeenCalledWith(expect.anything(), { width: 800, height: 600 }, 'image/webp', 0.85)
    expect(result.type).toBe('image/webp')
    expect(result.name).toBe('screen.webp')
  })

  it('줄일 필요도 바꿀 필요도 없는 jpg는 원본을 그대로 보낸다', async () => {
    const { codec, encode } = fakeCodec(800, 600)
    const file = fakeFile('small.jpg', 'image/jpeg', 200_000)
    expect(await prepareImage(file, codec)).toBe(file)
    expect(encode).not.toHaveBeenCalled()
  })

  // TC-IMG-025: gif는 그대로
  it('gif는 변환하지 않고 원본을 보낸다', async () => {
    const { codec } = fakeCodec(100, 100)
    const gif = fakeFile('anim.gif', 'image/gif', 2_000_000)
    expect(await prepareImage(gif, codec)).toBe(gif)
    expect(codec.decode).not.toHaveBeenCalled()
  })

  // TC-IMG-026: 4MB 넘는 gif
  it('4MB가 넘는 gif는 거부한다', async () => {
    await expect(prepareImage(fakeFile('big.gif', 'image/gif', MAX_UPLOAD_BYTES + 1))).rejects.toThrow(MESSAGES.tooLarge)
  })

  it('줄인 뒤에도 4MB를 넘으면 거부한다', async () => {
    const { codec } = fakeCodec(4000, 3000, MAX_UPLOAD_BYTES + 1)
    await expect(prepareImage(fakeFile('noisy.jpg', 'image/jpeg', 9_000_000), codec)).rejects.toThrow(MESSAGES.tooLarge)
  })

  it('읽을 수 없는 파일은 안내 메시지로 바꾼다', async () => {
    const codec: ImageCodec = { decode: vi.fn().mockRejectedValue(new Error('bad')), encode: vi.fn() }
    await expect(prepareImage(fakeFile('broken.jpg', 'image/jpeg'), codec)).rejects.toThrow(MESSAGES.decode)
  })
})
