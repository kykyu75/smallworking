// COMP-132 RichTextEditor — TipTap (DEC-001, REQ-018, REQ-019)
// 텍스트·서식 입력, 커서 위치에 이미지 삽입, 이미지 끌어서 이동.
import { Markdown } from '@tiptap/markdown'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useMemo, useState } from 'react'
import { SAFE_LINK, collectImageIds } from '../../lib/tiptapDoc'
import type { PostImage } from '../../types/image'
import type { TiptapDoc } from '../../types/post'
import ImageUploadButton from '../admin/ImageUploadButton'
import EditorToolbar from './EditorToolbar'
import { BodyImage } from './imageNode'
import { MarkdownTableAsText, PasteFormats } from './pasteExtension'

interface RichTextEditorProps {
  initialContent: TiptapDoc
  initialImages: PostImage[]
  onChange: (doc: TiptapDoc) => void
  /** 새로 업로드한 임시 이미지 (저장·취소 시 정리 대상 파악용) */
  onImageUploaded?: (image: PostImage) => void
  onUploadingChange?: (busy: boolean) => void
}

export default function RichTextEditor({
  initialContent,
  initialImages,
  onChange,
  onImageUploaded,
  onUploadingChange,
}: RichTextEditorProps) {
  // imageId → 이미지 정보. 에디터가 이미지를 그릴 때 주소를 찾는다.
  // 한 번 만든 Map을 계속 쓰고, 업로드할 때 항목을 추가한다 (화면을 다시 그릴 필요 없음).
  const [imageMap] = useState(() => new Map(initialImages.map((image) => [image.id, image])))
  const [imageCount, setImageCount] = useState(() => collectImageIds(initialContent).length)

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        underline: false, // 허용 목록에 없는 마크 (DATA_MODEL §5.4)
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: 'https',
          isAllowedUri: (url) => SAFE_LINK.test(url),
        },
      }),
      BodyImage.configure({ resolveUrl: (id) => imageMap.get(id)?.url }),
      // DEC-009: Markdown 원문·HTML 소스 붙여넣기 → 서식 변환
      // breaks: 한 줄 바꿈도 줄바꿈으로 살린다 (일반 글처럼 붙여 넣은 줄이 합쳐지지 않게)
      Markdown.configure({ markedOptions: { gfm: true, breaks: true } }),
      MarkdownTableAsText,
      PasteFormats,
    ],
    [imageMap],
  )

  const editor = useEditor({
    extensions,
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'tiptap min-h-80 px-4 py-3 focus:outline-none',
        'aria-label': '본문',
        role: 'textbox',
        'aria-multiline': 'true',
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as TiptapDoc
      setImageCount(collectImageIds(doc).length)
      onChange(doc)
    },
  })

  function handleUploaded(image: PostImage) {
    imageMap.set(image.id, image) // 주소를 먼저 등록한 뒤 삽입해야 바로 보인다
    onImageUploaded?.(image)
    editor?.chain().focus().insertBodyImage({ imageId: image.id }).run()
  }

  if (!editor) return null

  return (
    <div className="rounded-lg border border-gray-300 bg-white">
      <EditorToolbar
        editor={editor}
        extra={
          <ImageUploadButton currentCount={imageCount} onUploaded={handleUploaded} onBusyChange={onUploadingChange} />
        }
      />
      <EditorContent editor={editor} />
    </div>
  )
}
