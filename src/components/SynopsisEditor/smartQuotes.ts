import { Extension } from '@tiptap/core'

export const SmartQuotes = Extension.create({
  name: 'smartQuotes',

  addKeyboardShortcuts() {
    return {
      '"': () => {
        const { state, view } = this.editor
        const { selection } = state
        const { $from } = selection

        // 커서 앞의 문자 확인
        const textBefore = $from.nodeBefore?.textContent || ''
        const charBefore = textBefore[textBefore.length - 1]

        // 공백이나 줄바꿈 뒤, 또는 문장 시작이면 여는 따옴표
        const isOpening = !charBefore || charBefore === ' ' || charBefore === '\n' || charBefore === '\t'

        // 짝이 맞는지 확인 (이전에 여는 따옴표가 있으면 닫는 따옴표)
        let openCount = 0
        let closeCount = 0
        const text = state.doc.textContent
        const cursorPos = $from.pos - $from.parentOffset

        for (let i = 0; i < cursorPos; i++) {
          const char = text[i]
          if (char === '\u201C' || char === '"') {
            openCount++
          } else if (char === '\u201D' || char === '"') {
            closeCount++
          }
        }

        const shouldOpen = openCount === closeCount && isOpening
        const quote = shouldOpen ? '\u201C' : '\u201D'

        // 텍스트 삽입
        this.editor.commands.insertContent(quote)
        return true
      },
      "'": () => {
        const { state } = this.editor
        const { selection } = state
        const { $from } = selection

        // 커서 앞의 문자 확인
        const textBefore = $from.nodeBefore?.textContent || ''
        const charBefore = textBefore[textBefore.length - 1]

        // 공백이나 줄바꿈 뒤, 또는 문장 시작이면 여는 따옴표
        const isOpening = !charBefore || charBefore === ' ' || charBefore === '\n' || charBefore === '\t'

        // 짝이 맞는지 확인
        let openCount = 0
        let closeCount = 0
        const text = state.doc.textContent
        const cursorPos = $from.pos - $from.parentOffset

        for (let i = 0; i < cursorPos; i++) {
          const char = text[i]
          if (char === '\u2018' || char === "'") {
            openCount++
          } else if (char === '\u2019' || char === "'") {
            closeCount++
          }
        }

        const shouldOpen = openCount === closeCount && isOpening
        const quote = shouldOpen ? '\u2018' : '\u2019'

        // 텍스트 삽입
        this.editor.commands.insertContent(quote)
        return true
      },
      '.': () => {
        const { state } = this.editor
        const { selection } = state
        const { $from } = selection

        // 커서 앞의 텍스트 확인
        const textBefore = $from.nodeBefore?.textContent || ''
        const lastTwoChars = textBefore.slice(-2)

        // 앞에 점 2개가 있으면 말줄임표로 변환
        if (lastTwoChars === '..') {
          // 앞의 점 2개 삭제
          this.editor.commands.deleteRange({
            from: $from.pos - 2,
            to: $from.pos,
          })
          // 말줄임표 삽입
          this.editor.commands.insertContent('\u2026') // … (U+2026)
          return true
        }

        // 일반 점 입력
        return false
      },
    }
  },
})

