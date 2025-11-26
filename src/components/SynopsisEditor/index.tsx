import { useEffect, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { debounce } from '@/utils/debounce'

interface SynopsisEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
}

export default function SynopsisEditor({ 
  content, 
  onChange, 
  placeholder = '시놉시스를 작성해주세요...' 
}: SynopsisEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content,
    editorProps: {
      attributes: {
        class: 'mx-auto focus:outline-none min-h-[400px] p-3 sm:p-4 font-sans',
        style: 'font-family: Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; font-size: 16px;',
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      debouncedOnChange(html)
    },
  })

  // Debounced onChange
  const debouncedOnChange = useCallback(
    debounce((html: string) => {
      onChange(html)
    }, 500),
    [onChange]
  )

  // Update editor content when prop changes (only if editor is not focused)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 에디터가 포커스되어 있지 않을 때만 내용 업데이트
      if (!editor.isFocused) {
        editor.commands.setContent(content, false) // emitUpdate: false로 설정하여 onChange 트리거 방지
      }
    }
  }, [content, editor])

  if (!editor) {
    return <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 min-h-[400px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">로딩 중...</div>
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
      {/* Toolbar */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-2 flex gap-1 flex-wrap">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('bold')
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          <strong>B</strong>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('italic')
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          <em>I</em>
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('heading', { level: 1 })
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('heading', { level: 2 })
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('bulletList')
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          • 목록
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-3 py-1 rounded text-sm font-medium ${
            editor.isActive('orderedList')
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          1. 목록
        </button>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
}

