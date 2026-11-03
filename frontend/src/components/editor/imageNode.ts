// 본문 이미지 노드 (DEC-001): 문서에는 imageId와 alt만 저장하고, src는 저장하지 않는다.
// 화면에 그릴 때만 resolveUrl(imageId)로 주소를 찾는다.
// 다른 사이트에서 복사해 붙인 <img>(data-image-id 없음)는 받아들이지 않는다.
import { Node, mergeAttributes } from '@tiptap/react'

export interface BodyImageOptions {
  resolveUrl: (imageId: number) => string | undefined
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    bodyImage: {
      insertBodyImage: (attrs: { imageId: number; alt?: string | null }) => ReturnType
    }
  }
}

export const BodyImage = Node.create<BodyImageOptions>({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true, // 끌어서 본문 안 위치를 바꿀 수 있다 (REQ-019)

  addOptions() {
    return { resolveUrl: () => undefined }
  },

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (element) => {
          const value = Number(element.getAttribute('data-image-id'))
          return Number.isInteger(value) && value > 0 ? value : null
        },
        renderHTML: (attrs) => ({ 'data-image-id': attrs.imageId }),
      },
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute('alt') || null,
        renderHTML: (attrs) => (attrs.alt ? { alt: attrs.alt } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'img[data-image-id]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const src = this.options.resolveUrl(node.attrs.imageId) ?? ''
    return ['img', mergeAttributes(HTMLAttributes, { src, loading: 'lazy' })]
  },

  addCommands() {
    return {
      insertBodyImage:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { imageId: attrs.imageId, alt: attrs.alt ?? null } }),
    }
  },
})
