// DEC-010 본문 표 — TipTap 공식 표 확장을 허용 서식(DATA_MODEL §5.4)에 맞게 설정한다.
// - 칸 안에는 표를 넣을 수 없다 (표 안의 표 금지)
// - 칸 합치기·너비 조절은 쓰지 않는다 (저장하지 않음)
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table'
import { Fragment, type Node as PMNode } from '@tiptap/pm/model'

/** 칸 안에 들어갈 수 있는 블록 (table 제외) */
const CELL_CONTENT = '(paragraph | heading | bulletList | orderedList | blockquote | codeBlock | horizontalRule | image)+'

const BodyTableCell = TableCell.extend({ content: CELL_CONTENT })
const BodyTableHeader = TableHeader.extend({ content: CELL_CONTENT })

export const TABLE_EXTENSIONS = [
  Table.configure({ resizable: false, renderWrapper: true, HTMLAttributes: { class: 'body-table' } }),
  TableRow,
  BodyTableHeader,
  BodyTableCell,
]

const CELL_NAMES = new Set(['tableCell', 'tableHeader'])

/** 칸 합치기를 없애 짧아진 행은 끝에 빈 칸을 채워 열 수를 맞춘다 */
function padTableRows(table: PMNode): PMNode {
  let width = 0
  table.forEach((row) => {
    width = Math.max(width, row.childCount)
  })
  const rows: PMNode[] = []
  table.forEach((row) => {
    if (row.childCount >= width || row.childCount === 0) {
      rows.push(row)
      return
    }
    const cellType = row.lastChild!.type
    const filler = Array.from({ length: width - row.childCount }, () => cellType.createAndFill()!)
    rows.push(row.copy(row.content.append(Fragment.from(filler))))
  })
  return table.copy(Fragment.from(rows))
}

/** 붙여 넣은 내용의 칸 합치기·너비를 없애고, 행마다 열 수를 맞춘다 */
export function flattenCellSpans(fragment: Fragment): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    let next = node
    if (CELL_NAMES.has(node.type.name) && (node.attrs.colspan !== 1 || node.attrs.rowspan !== 1 || node.attrs.colwidth)) {
      next = node.type.create({ ...node.attrs, colspan: 1, rowspan: 1, colwidth: null }, node.content, node.marks)
    }
    if (next.content.size > 0) next = next.copy(flattenCellSpans(next.content))
    if (next.type.name === 'table') next = padTableRows(next)
    nodes.push(next)
  })
  return Fragment.from(nodes)
}
