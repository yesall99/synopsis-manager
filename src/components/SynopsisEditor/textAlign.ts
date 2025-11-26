import { Extension } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textAlign: {
      setTextAlign: (align: 'left' | 'center' | 'right' | 'justify') => ReturnType
      unsetTextAlign: () => ReturnType
    }
  }
}

export const TextAlign = Extension.create({
  name: 'textAlign',

  addOptions() {
    return {
      types: ['heading', 'paragraph'],
      defaultAlignment: 'left',
      alignments: ['left', 'center', 'right', 'justify'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          textAlign: {
            default: this.options.defaultAlignment,
            parseHTML: (element) => element.style.textAlign || this.options.defaultAlignment,
            renderHTML: (attributes) => {
              if (attributes.textAlign === this.options.defaultAlignment) {
                return {}
              }
              return {
                style: `text-align: ${attributes.textAlign}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setTextAlign:
        (alignment: 'left' | 'center' | 'right' | 'justify') =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { $from, $to } = selection

          state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              if (dispatch) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  textAlign: alignment,
                })
              }
            }
          })

          if (dispatch) {
            dispatch(tr)
          }
          return true
        },
      unsetTextAlign:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          const { $from, $to } = selection

          state.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
            if (this.options.types.includes(node.type.name)) {
              if (dispatch) {
                const attrs = { ...node.attrs }
                delete attrs.textAlign
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

