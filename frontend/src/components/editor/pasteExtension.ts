// 붙여넣기 변환 (DEC-009, COMP-132)
// Markdown 원문·HTML 소스를 붙여 넣으면 서식으로 바꿔 커서 위치에 넣는다.
// 그 외(서식 있는 복사, 일반 글, 코드블록 안)는 TipTap 기본 붙여넣기에 맡긴다.
import '@tiptap/markdown' // editor.markdown 타입
import { DOMParser as SchemaParser, Slice, type Schema } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Extension, type JSONContent } from '@tiptap/react'
import {
  choosePasteFormat,
  remapHeadingsInHtml,
  remapHeadingsInMarkdown,
  sanitizePastedDoc,
  unnestTablesInHtml,
} from '../../lib/pasteFormats'
import type { TiptapNode } from '../../types/post'
import { flattenCellSpans } from './tableNodes'

/**
 * HTML 소스 → 문서 JSON. 브라우저 DOMParser가 만든 문서는 화면에 붙지 않아 스크립트·이미지 로딩이 일어나지 않는다.
 * 에디터 스키마에 있는 노드·마크만 읽히고 나머지 태그·속성은 버려진다.
 */
function parseHtmlSource(html: string, schema: Schema): JSONContent {
  const body = new window.DOMParser().parseFromString(html, 'text/html').body
  return SchemaParser.fromSchema(schema).parse(body).toJSON() as JSONContent
}

export const PasteFormats = Extension.create({
  name: 'pasteFormats',

  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        key: new PluginKey('pasteFormats'),
        props: {
          // 서식 있는 복사(웹페이지 표 등)도 칸 합치기·너비는 없앤다 (DEC-010)
          transformPastedHTML: (html) => unnestTablesInHtml(html), // 표 안의 표는 문단으로 푼다
          transformPasted: (slice) => new Slice(flattenCellSpans(slice.content), slice.openStart, slice.openEnd),
          handlePaste: (view, event) => {
            const data = event.clipboardData
            if (!data) return false
            if (view.state.selection.$from.parent.type.spec.code) return false // 코드블록 안에서는 글자 그대로

            const text = data.getData('text/plain')
            const format = choosePasteFormat(text, data.getData('text/html'))
            if (format === 'default') return false

            let parsed: JSONContent | undefined
            try {
              parsed =
                format === 'markdown'
                  ? editor.markdown?.parse(remapHeadingsInMarkdown(text))
                  : parseHtmlSource(unnestTablesInHtml(remapHeadingsInHtml(text)), editor.schema)
            } catch {
              return false // 해석하지 못하면 기본 붙여넣기
            }
            if (!parsed) return false

            const doc = sanitizePastedDoc(parsed as TiptapNode) // 형태가 같은 JSON 문서 (정리 과정에서 검사한다)
            if (!doc.content?.length) return false
            try {
              editor.schema.nodeFromJSON(doc).check() // 구조가 맞지 않으면 기본 붙여넣기
            } catch {
              return false
            }
            return editor.commands.insertContent(doc.content)
          },
        },
      }),
    ]
  },
})
