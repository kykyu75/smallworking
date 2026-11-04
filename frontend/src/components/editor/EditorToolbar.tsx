// COMP-135 EditorToolbar — 버튼은 DATA_MODEL v1.0 §5.4 허용 노드·마크와 정확히 일치해야 한다 (REQ-044)
import { useEditorState, type Editor } from '@tiptap/react'
import type { ReactNode } from 'react'
import { SAFE_LINK } from '../../lib/tiptapDoc'

interface ToolButtonProps {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, active = false, disabled = false, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // 버튼을 눌러도 본문 선택(커서)을 잃지 않게
      onClick={onClick}
      className={`min-w-8 rounded px-2 py-1 text-sm ${active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'} disabled:opacity-30`}
    >
      {children}
    </button>
  )
}

export default function EditorToolbar({ editor, extra }: { editor: Editor; extra?: ReactNode }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
      table: e.isActive('table'),
    }),
  })

  function editLink() {
    const current = (editor.getAttributes('link').href as string | undefined) ?? ''
    const input = window.prompt('링크 주소 (http://, https://, mailto:) — 비우면 링크를 없앱니다', current)
    if (input === null) return
    const href = input.trim()
    if (href === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    if (!SAFE_LINK.test(href)) {
      window.alert('http://, https://, mailto:로 시작하는 주소만 넣을 수 있습니다.')
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run()
  }

  const chain = () => editor.chain().focus()

  return (
    <div role="toolbar" aria-label="서식" className="flex flex-wrap items-center gap-1 border-b border-gray-200 p-2">
      <ToolButton label="굵게" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <b>B</b>
      </ToolButton>
      <ToolButton label="기울임" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <i>I</i>
      </ToolButton>
      <ToolButton label="취소선" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <s>S</s>
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-gray-200" aria-hidden />
      <ToolButton label="제목 2" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolButton>
      <ToolButton label="제목 3" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolButton>
      <ToolButton label="글머리 목록" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        •
      </ToolButton>
      <ToolButton label="번호 목록" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        1.
      </ToolButton>
      <ToolButton label="인용" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
        ❝
      </ToolButton>
      <ToolButton label="코드 블록" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        {'</>'}
      </ToolButton>
      <ToolButton label="구분선" onClick={() => chain().setHorizontalRule().run()}>
        ―
      </ToolButton>
      <ToolButton label="링크" active={state.link} onClick={editLink}>
        🔗
      </ToolButton>
      {/* DEC-010 표: 3×3(첫 행은 제목 칸)으로 넣고, 표 안에 커서가 있을 때만 행·열 버튼을 보여준다 */}
      <ToolButton
        label="표 넣기"
        disabled={state.table}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        ▦
      </ToolButton>
      {state.table && (
        <span role="group" aria-label="표 편집" className="flex flex-wrap items-center gap-1 rounded bg-gray-50 px-1">
          <ToolButton label="아래에 행 추가" onClick={() => chain().addRowAfter().run()}>
            +행
          </ToolButton>
          <ToolButton label="오른쪽에 열 추가" onClick={() => chain().addColumnAfter().run()}>
            +열
          </ToolButton>
          <ToolButton label="행 삭제" onClick={() => chain().deleteRow().run()}>
            −행
          </ToolButton>
          <ToolButton label="열 삭제" onClick={() => chain().deleteColumn().run()}>
            −열
          </ToolButton>
          <ToolButton label="표 삭제" onClick={() => chain().deleteTable().run()}>
            표✕
          </ToolButton>
        </span>
      )}
      {extra && <span className="ml-auto">{extra}</span>}
    </div>
  )
}
