// COMP-133 ImageUploadButton (REQ-018, 020, 021, DEC-002, DEC-007)
// 이미지 선택 → 사전 검사·브라우저 축소 → 업로드(API-019) → onUploaded로 에디터에 전달 (에디터 연결은 M5)
import { useRef, useState, type ChangeEvent } from 'react'
import { ApiError } from '../../services/apiClient'
import { imageService } from '../../services/imageService'
import { ACCEPTED_TYPES, ImageValidationError, prepareImage } from '../../lib/imageResize'
import type { PostImage } from '../../types/image'

export const MAX_IMAGES_PER_POST = 20

interface ImageUploadButtonProps {
  /** 현재 본문에 있는 이미지 수 */
  currentCount: number
  maxCount?: number
  onUploaded: (image: PostImage) => void
  /** 업로드 중 여부 (업로드 중에는 저장 버튼을 막는다, TC-IMG-024) */
  onBusyChange?: (busy: boolean) => void
  /** 테스트에서 바꿔 끼우는 축소 함수 */
  prepare?: (file: File) => Promise<File>
}

function errorText(file: File, err: unknown): string {
  const reason = err instanceof ImageValidationError || err instanceof ApiError ? err.message : '업로드하지 못했습니다.'
  return `${file.name}: ${reason}`
}

export default function ImageUploadButton({
  currentCount,
  maxCount = MAX_IMAGES_PER_POST,
  onUploaded,
  onBusyChange,
  prepare = prepareImage,
}: ImageUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [messages, setMessages] = useState<string[]>([])

  const remaining = Math.max(0, maxCount - currentCount)
  const full = remaining === 0
  const busy = progress !== null

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = '' // 같은 파일을 다시 고를 수 있게
    if (selected.length === 0) return

    const files = selected.slice(0, remaining)
    const notes: string[] = []
    if (selected.length > files.length) {
      notes.push(`이미지는 ${maxCount}장까지 넣을 수 있어 앞의 ${files.length}장만 올립니다.`)
    }

    setMessages(notes)
    setProgress({ done: 0, total: files.length })
    onBusyChange?.(true)
    try {
      // 본문 순서를 지키기 위해 한 장씩 차례대로 올린다
      for (const [index, file] of files.entries()) {
        try {
          const prepared = await prepare(file)
          const image = await imageService.upload(prepared)
          onUploaded(image)
        } catch (err) {
          notes.push(errorText(file, err))
          setMessages([...notes])
        }
        setProgress({ done: index + 1, total: files.length })
      }
    } finally {
      setProgress(null)
      onBusyChange?.(false)
    }
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={full || busy}
          onClick={() => inputRef.current?.click()}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"
        >
          🖼 이미지
        </button>
        <span className="text-xs text-gray-500" aria-live="polite">
          {busy ? `업로드 중… (${progress.done}/${progress.total})` : `이미지 ${currentCount} / ${maxCount}`}
        </span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        hidden
        data-testid="image-file-input"
        onChange={handleChange}
      />
      {full && <p className="text-xs text-gray-500">이미지는 {maxCount}장까지 넣을 수 있습니다.</p>}
      {messages.length > 0 && (
        <ul role="alert" className="text-xs text-red-600">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
