import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      setFontFamily: (fontFamily: string) => ReturnType
      unsetFontFamily: () => ReturnType
    }
  }
}

export const FontFamily = Extension.create({
  name: 'fontFamily',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: (element) => element.style.fontFamily || null,
            renderHTML: (attributes) => {
              if (!attributes.fontFamily) {
                return {}
              }
              return {
                style: `font-family: ${attributes.fontFamily}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily:
        (fontFamily: string) =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { $from, $to } = selection

          // 선택된 텍스트가 없으면 현재 paragraph에 적용
          if (selection.empty) {
            const $pos = $from
            let targetPos = $pos.pos
            let targetNode = $pos.parent

            // 현재 위치가 paragraph나 heading인지 확인
            if (this.options.types.includes(targetNode.type.name)) {
              if (dispatch) {
                tr.setNodeMarkup($pos.before($pos.depth), undefined, {
                  ...targetNode.attrs,
                  fontFamily: fontFamily,
                })
              }
            } else {
              // paragraph를 찾아서 적용
              let depth = $pos.depth
              while (depth > 0) {
                const node = $pos.node(depth)
                if (this.options.types.includes(node.type.name)) {
                  if (dispatch) {
                    tr.setNodeMarkup($pos.before(depth), undefined, {
                      ...node.attrs,
                      fontFamily: fontFamily,
                    })
                  }
                  break
                }
                depth--
              }
            }
          } else {
            // 선택된 텍스트가 있으면 해당 범위의 모든 paragraph/heading에 적용
            state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
              if (this.options.types.includes(node.type.name)) {
                if (dispatch) {
                  tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    fontFamily: fontFamily,
                  })
                }
              }
            })
          }

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },
      unsetFontFamily:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { $from, $to } = selection

          state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              if (dispatch) {
                const attrs = { ...node.attrs }
                delete attrs.fontFamily
                tr.setNodeMarkup(pos, undefined, attrs)
              }
            }
          })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },
    }
  },
})

