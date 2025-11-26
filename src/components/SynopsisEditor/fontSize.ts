import { Mark } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: number) => ReturnType
      unsetFontSize: () => ReturnType
    }
  }
}

export const FontSize = Mark.create({
  name: 'fontSize',

  // fontSize가 null인 마크는 제외
  excludes: '_',

  addAttributes() {
    return {
      fontSize: {
        default: null,
        parseHTML: (element) => {
          try {
            if (!element || !element.style) {
              return null
            }
            const fontSize = element.style.fontSize
            if (fontSize) {
              const match = fontSize.match(/(\d+)px/)
              if (match) {
                const size = parseInt(match[1])
                if (size > 0 && size <= 1000) {
                  return size
                }
              }
            }
            return null
          } catch (error) {
            console.error('FontSize parseHTML error:', error)
            return null
          }
        },
        // renderHTML은 Mark의 renderHTML에서 처리
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-font-size]',
        getAttrs: (node) => {
          try {
            const element = node as HTMLElement
            const dataFontSize = element.getAttribute('data-font-size')
            if (dataFontSize) {
              const size = parseInt(dataFontSize)
              if (size > 0 && size <= 1000) {
                return { fontSize: size }
              }
            }
            return null
          } catch (error) {
            console.error('FontSize parseHTML error:', error)
            return null
          }
        },
      },
      {
        tag: 'span[style*="font-size"]',
        getAttrs: (node) => {
          try {
            const element = node as HTMLElement
            if (!element || !element.style) {
              return null
            }
            const fontSize = element.style.fontSize
            if (fontSize) {
              const match = fontSize.match(/(\d+)px/)
              if (match) {
                const size = parseInt(match[1])
                if (size > 0 && size <= 1000) {
                  return { fontSize: size }
                }
              }
            }
            return null
          } catch (error) {
            console.error('FontSize parseHTML error:', error)
            return null
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    try {
      // HTMLAttributes가 null이거나 undefined인 경우 처리
      if (HTMLAttributes == null || typeof HTMLAttributes !== 'object' || Array.isArray(HTMLAttributes)) {
        // fontSize가 null인 마크는 렌더링하지 않음
        return false
      }
      const fontSize = HTMLAttributes.fontSize
      // fontSize가 없거나 유효하지 않은 경우
      if (fontSize == null || typeof fontSize !== 'number' || isNaN(fontSize) || fontSize <= 0 || fontSize > 1000) {
        // fontSize가 null인 마크는 렌더링하지 않음
        return false
      }
      // 인라인 스타일은 CSS보다 우선순위가 높으므로 !important 불필요
      const fontSizeValue = Math.round(fontSize)
      if (fontSizeValue <= 0 || fontSizeValue > 1000) {
        return false
      }
      // 속성 객체 생성 및 검증 (line-height는 항상 1.8, font-size는 사용자가 설정한 값)
      const attrs: Record<string, string> = {
        style: `font-size: ${fontSizeValue}px !important; line-height: 1.8 !important;`,
        'data-font-size': fontSizeValue.toString(),
      }
      // ProseMirror 렌더링 스펙에 맞는 배열 반환
      // 형식: [tagName, attributes, childNodeIndex]
      return ['span', attrs, 0]
    } catch (error) {
      console.error('FontSize renderHTML error:', error, HTMLAttributes)
      return false
    }
  },

  addCommands() {
    return {
      setFontSize:
        (size: number) =>
        ({ commands }) => {
          return commands.setMark(this.name, { fontSize: size })
        },
      unsetFontSize:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

