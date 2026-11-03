import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MESSAGES, ImageValidationError } from '../../lib/imageResize'
import { mockApi } from '../../test/mockApi'
import type { PostImage } from '../../types/image'
import ImageUploadButton from './ImageUploadButton'

function image(id: number): PostImage {
  return {
    id,
    url: `/uploads/images/2026/11/${id}.jpg`,
    thumbnail_url: `/uploads/images/2026/11/${id}_thumb.jpg`,
    original_name: `${id}.jpg`,
    mime_type: 'image/jpeg',
    file_size: 1000,
    width: 800,
    height: 600,
  }
}

function file(name: string, type = 'image/jpeg', size = 1000) {
  return new File([new Uint8Array(size)], name, { type })
}

function choose(files: File[]) {
  fireEvent.change(screen.getByTestId('image-file-input'), { target: { files } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ImageUploadButton (COMP-133)', () => {
  // TC-IMG-001 (UI): 축소한 파일을 FormData로 올리고 결과를 넘긴다
  it('선택한 이미지를 준비해서 올리고 결과를 전달한다', async () => {
    let next = 1
    const fetchMock = mockApi([{ method: 'POST', path: '/api/images', respond: () => ({ status: 201, body: image(next++) }) }])
    const prepare = vi.fn(async (f: File) => new File([f], `ready-${f.name}`, { type: 'image/jpeg' }))
    const onUploaded = vi.fn()
    render(<ImageUploadButton currentCount={0} onUploaded={onUploaded} prepare={prepare} />)

    choose([file('a.jpg'), file('b.jpg')])
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2))
    expect(onUploaded.mock.calls.map(([img]) => img.id)).toEqual([1, 2]) // 고른 순서대로

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/images')
    const sent = (init!.body as FormData).get('file') as File
    expect(sent.name).toBe('ready-a.jpg')
  })

  // TC-IMG-008: 20장이면 버튼 비활성화 + 안내
  it('이미지가 20장이면 버튼을 막고 안내한다', () => {
    mockApi([])
    render(<ImageUploadButton currentCount={20} onUploaded={vi.fn()} />)
    expect(screen.getByRole('button', { name: '🖼 이미지' })).toBeDisabled()
    expect(screen.getByText('이미지는 20장까지 넣을 수 있습니다.')).toBeInTheDocument()
  })

  it('남은 개수보다 많이 고르면 앞에서부터 남은 개수만 올린다', async () => {
    let next = 1
    mockApi([{ method: 'POST', path: '/api/images', respond: () => ({ status: 201, body: image(next++) }) }])
    const onUploaded = vi.fn()
    render(<ImageUploadButton currentCount={18} onUploaded={onUploaded} prepare={async (f) => f} />)

    choose([file('1.jpg'), file('2.jpg'), file('3.jpg')])
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('alert')).toHaveTextContent('앞의 2장만 올립니다')
  })

  // TC-IMG-010 (UI): 검사에서 걸린 파일은 요청하지 않고 파일별로 안내
  it('검사에 걸린 파일은 올리지 않고 이유를 보여준다', async () => {
    const fetchMock = mockApi([{ method: 'POST', path: '/api/images', status: 201, body: image(1) }])
    const prepare = vi.fn(async (f: File) => {
      if (f.name === 'huge.jpg') throw new ImageValidationError(MESSAGES.original)
      return f
    })
    const onUploaded = vi.fn()
    render(<ImageUploadButton currentCount={0} onUploaded={onUploaded} prepare={prepare} />)

    choose([file('huge.jpg'), file('ok.jpg')])
    await waitFor(() => expect(onUploaded).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('alert')).toHaveTextContent(`huge.jpg: ${MESSAGES.original}`)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('서버 오류 메시지를 파일별로 보여준다', async () => {
    mockApi([
      {
        method: 'POST',
        path: '/api/images',
        status: 415,
        body: { error: { code: 'UNSUPPORTED_IMAGE_TYPE', message: 'jpg, png, webp, gif 이미지만 올릴 수 있습니다.', details: null } },
      },
    ])
    render(<ImageUploadButton currentCount={0} onUploaded={vi.fn()} prepare={async (f) => f} />)
    choose([file('fake.jpg')])
    expect(await screen.findByRole('alert')).toHaveTextContent('fake.jpg: jpg, png, webp, gif 이미지만 올릴 수 있습니다.')
  })

  // TC-IMG-024: 업로드 중에는 busy=true (에디터가 저장 버튼을 막는다)
  it('업로드 중에는 busy 상태를 알리고 버튼을 막는다', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    mockApi([{ method: 'POST', path: '/api/images', status: 201, body: image(1) }])
    const onBusyChange = vi.fn()
    render(
      <ImageUploadButton
        currentCount={0}
        onUploaded={vi.fn()}
        onBusyChange={onBusyChange}
        prepare={async (f) => {
          await gate
          return f
        }}
      />,
    )

    choose([file('a.jpg')])
    await waitFor(() => expect(onBusyChange).toHaveBeenCalledWith(true))
    expect(screen.getByRole('button', { name: '🖼 이미지' })).toBeDisabled()
    expect(screen.getByText('업로드 중… (0/1)')).toBeInTheDocument()

    release()
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false))
    expect(screen.getByText('이미지 0 / 20')).toBeInTheDocument()
  })
})
