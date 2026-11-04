// COMP-032 PostContent — TipTap JSON 렌더러 (DEC-001, COMPONENT_SPEC §8.3, REQ-018/019/037/044)
// 허용된 노드·마크만 React 요소로 그린다. dangerouslySetInnerHTML을 쓰지 않으며, 텍스트는 React가 이스케이프한다.
// 편집기(TipTap)를 불러오지 않아 공개 화면에서 가볍다.
import { Fragment, type ReactNode } from 'react'
import { SAFE_LINK } from '../../lib/tiptapDoc'
import type { PostImage } from '../../types/image'
import type { TiptapMark, TiptapNode } from '../../types/post'

interface PostContentProps {
  content: TiptapNode
  images: PostImage[]
}

function renderMarks(text: string, marks: TiptapMark[] | undefined, key: string): ReactNode {
  let node: ReactNode = text
  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'bold':
        node = <strong>{node}</strong>
        break
      case 'italic':
        node = <em>{node}</em>
        break
      case 'strike':
        node = <s>{node}</s>
        break
      case 'code':
        node = <code className="rounded bg-gray-100 px-1 py-0.5 text-[0.9em]">{node}</code>
        break
      case 'link': {
        const href = mark.attrs?.href
        // http(s)·mailto만 링크로 만든다. 그 외(javascript: 등)는 글자만 보여준다 (TC-SEC-004)
        if (typeof href === 'string' && SAFE_LINK.test(href.trim())) {
          node = (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-2">
              {node}
            </a>
          )
        }
        break
      }
      default:
        break // 모르는 마크는 무시
    }
  }
  return <Fragment key={key}>{node}</Fragment>
}

export default function PostContent({ content, images }: PostContentProps) {
  const imageById = new Map(images.map((image) => [image.id, image]))

  function children(node: TiptapNode, key: string): ReactNode[] {
    return (node.content ?? []).map((child, index) => render(child, `${key}.${index}`))
  }

  function render(node: TiptapNode, key: string): ReactNode {
    switch (node.type) {
      case 'doc':
        return <Fragment key={key}>{children(node, key)}</Fragment>
      case 'paragraph':
        return <p key={key}>{children(node, key)}</p>
      case 'text':
        return typeof node.text === 'string' ? renderMarks(node.text, node.marks, key) : null
      case 'heading':
        return node.attrs?.level === 3 ? (
          <h3 key={key}>{children(node, key)}</h3>
        ) : (
          <h2 key={key}>{children(node, key)}</h2>
        )
      case 'bulletList':
        return <ul key={key}>{children(node, key)}</ul>
      case 'orderedList': {
        const start = typeof node.attrs?.start === 'number' ? node.attrs.start : undefined
        return (
          <ol key={key} start={start}>
            {children(node, key)}
          </ol>
        )
      }
      case 'listItem':
        return <li key={key}>{children(node, key)}</li>
      case 'blockquote':
        return <blockquote key={key}>{children(node, key)}</blockquote>
      case 'codeBlock':
        return (
          <pre key={key}>
            <code>{(node.content ?? []).map((child) => child.text ?? '').join('')}</code>
          </pre>
        )
      case 'horizontalRule':
        return <hr key={key} />
      case 'hardBreak':
        return <br key={key} />
      case 'image': {
        const id = node.attrs?.imageId
        const image = typeof id === 'number' ? imageById.get(id) : undefined
        if (!image) return null // 목록에 없는 이미지는 자리를 생략
        const alt = typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''
        return (
          <figure key={key}>
            <img src={image.url} alt={alt} width={image.width} height={image.height} loading="lazy" />
          </figure>
        )
      }
      // DEC-010 표: 표 안에서만 가로로 밀어 보고, 페이지는 넘치지 않는다 (REQ-036)
      case 'table':
        return (
          <div key={key} className="table-scroll" role="region" aria-label="표" tabIndex={0}>
            <table>
              <tbody>{children(node, key)}</tbody>
            </table>
          </div>
        )
      case 'tableRow':
        return <tr key={key}>{children(node, key)}</tr>
      case 'tableHeader':
      case 'tableCell': {
        const Cell = node.type === 'tableHeader' ? 'th' : 'td'
        const align = node.attrs?.align
        const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : undefined
        return (
          <Cell key={key} className={alignClass} scope={node.type === 'tableHeader' ? 'col' : undefined}>
            {children(node, key)}
          </Cell>
        )
      }
      default:
        return null // 모르는 노드는 그리지 않는다
    }
  }

  return <div className="post-content">{render(content, 'root')}</div>
}
