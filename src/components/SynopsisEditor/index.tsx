import { useEffect, useCallback, useState, useRef, useMemo, useImperativeHandle, forwardRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { debounce } from '@/utils/debounce'
import { SmartQuotes } from './smartQuotes'
import { TextAlign } from './textAlign'
import { FontFamily } from './fontFamily'
import { FontSize } from './fontSize'
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, Type, ChevronDown, Check, ChevronLeft, Save, Settings2, Minimize2 } from 'lucide-react'

interface SynopsisEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  bodyWidth?: 400 | 600 | 800
  firstLineIndent?: 'none' | '0.5' | '1' | '2'
  paragraphSpacing?: 'none' | '0.5' | '1' | '2'
  isWritingMode?: boolean
  onSave?: () => void
  isSaving?: boolean
  wordCounts?: { withSpaces: number; withoutSpaces: number }
  onShowBodySettings?: () => void
  showBodySettings?: boolean
  onExitWritingMode?: () => void
}

export interface SynopsisEditorRef {
  getContent: () => string
}

const SynopsisEditor = forwardRef<SynopsisEditorRef, SynopsisEditorProps>(function SynopsisEditor({
  content, 
  onChange, 
  placeholder = '시놉시스를 작성해주세요...',
  bodyWidth,
  firstLineIndent,
  paragraphSpacing,
  isWritingMode = false,
  onSave,
  isSaving = false,
  wordCounts,
  onShowBodySettings,
  showBodySettings = false,
  onExitWritingMode,
}, ref) {
  const [isListMenuOpen, setIsListMenuOpen] = useState(false)
  const [isAlignMenuOpen, setIsAlignMenuOpen] = useState(false)
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false)
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false)
  const listMenuRef = useRef<HTMLDivElement>(null)
  const alignMenuRef = useRef<HTMLDivElement>(null)
  const fontMenuRef = useRef<HTMLDivElement>(null)
  const fontSizeMenuRef = useRef<HTMLDivElement>(null)
  const fontSizeMenuContainerRef = useRef<HTMLDivElement>(null)
  const fontMenuContainerRef = useRef<HTMLDivElement>(null)

  // localStorage에서 마지막 선택 폰트 불러오기
  const getDefaultFont = () => {
    return localStorage.getItem('editorFontFamily') || 'Pretendard'
  }

  const defaultFont = getDefaultFont()
  const [currentFont, setCurrentFont] = useState(defaultFont)
  const [currentFontSize, setCurrentFontSize] = useState(18)
  const [isMobile, setIsMobile] = useState(false)

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Debounced onChange (useEditor 전에 정의)
  const debouncedOnChange = useCallback(
    debounce((html: string) => {
      onChange(html)
    }, 500),
    [onChange]
  )

  // 본문 설정 스타일 계산
  const editorStyle = useMemo(() => {
    let style = `font-family: ${currentFont}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif; font-size: 18px; line-height: 1.8;`
    
    // bodyWidth는 외부 컨테이너에서 제어하므로 여기서는 제거
    return style
  }, [currentFont])

  const editor = useEditor({
    extensions: [StarterKit, SmartQuotes, TextAlign, FontFamily, FontSize],
    content,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px]',
        style: `${editorStyle}${bodyWidth && !isMobile ? ` max-width: ${bodyWidth}px; margin: 0 auto; padding: 24px;` : ' padding: 24px;'}`,
      },
    },
    onUpdate: ({ editor, transaction }) => {
      // fontSize가 null인 마크 제거 (무한 루프 방지를 위해 transaction이 이미 변경된 경우만)
      if (transaction.docChanged) {
        const { state } = editor
        const { tr } = state
        let hasInvalidMarks = false
        
        state.doc.descendants((node, pos) => {
          if (node.marks) {
            node.marks.forEach((mark) => {
              if (mark.type.name === 'fontSize' && (!mark.attrs.fontSize || mark.attrs.fontSize === null)) {
                tr.removeMark(pos, pos + node.nodeSize, mark.type)
                hasInvalidMarks = true
              }
            })
          }
        })
        
        if (hasInvalidMarks) {
          editor.view.dispatch(tr)
          return // 다음 onUpdate에서 처리
        }
      }
      
      try {
        const html = editor.getHTML()
        debouncedOnChange(html)
      } catch (error) {
        console.error('onUpdate getHTML error:', error)
      }
    },
  })

  // ref를 통해 최신 content 가져오기
  useImperativeHandle(ref, () => ({
    getContent: () => {
      if (editor) {
        try {
          // getHTML 호출 전에 fontSize가 null인 마크 제거
          const { state } = editor
          const { tr } = state
          let hasChanges = false
          
          state.doc.descendants((node, pos) => {
            if (node.marks) {
              node.marks.forEach((mark) => {
                if (mark.type.name === 'fontSize' && (!mark.attrs.fontSize || mark.attrs.fontSize === null)) {
                  tr.removeMark(pos, pos + node.nodeSize, mark.type)
                  hasChanges = true
                }
              })
            }
          })
          
          if (hasChanges) {
            editor.view.dispatch(tr)
          }
          
          return editor.getHTML()
        } catch (error) {
          console.error('getHTML error:', error)
          // 에러 발생 시 현재 content state 반환
          return content
        }
      }
      return content
    },
  }), [editor, content])

  // Update editor content when prop changes (only if editor is not focused)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // 에디터가 포커스되어 있지 않을 때만 내용 업데이트
      if (!editor.isFocused) {
        editor.commands.setContent(content, false) // emitUpdate: false로 설정하여 onChange 트리거 방지
      }
    }
  }, [content, editor])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (listMenuRef.current && !listMenuRef.current.contains(event.target as Node)) {
        setIsListMenuOpen(false)
      }
      if (alignMenuRef.current && !alignMenuRef.current.contains(event.target as Node)) {
        setIsAlignMenuOpen(false)
      }
      if (fontMenuRef.current && !fontMenuRef.current.contains(event.target as Node) &&
          fontMenuContainerRef.current && !fontMenuContainerRef.current.contains(event.target as Node)) {
        setIsFontMenuOpen(false)
      }
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(event.target as Node) &&
          fontSizeMenuContainerRef.current && !fontSizeMenuContainerRef.current.contains(event.target as Node)) {
        setIsFontSizeMenuOpen(false)
      }
    }

    if (isListMenuOpen || isAlignMenuOpen || isFontMenuOpen || isFontSizeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isListMenuOpen, isAlignMenuOpen, isFontMenuOpen, isFontSizeMenuOpen])

  const fonts = [
    { name: 'Pretendard', label: '프리텐다드' },
    { name: 'Ridibatang', label: '리디바탕' },
  ]

  const getCurrentFontLabel = () => {
    return fonts.find(f => f.name === currentFont)?.label || fonts[0].label
  }

  const handleFontChange = (fontFamily: string) => {
    setCurrentFont(fontFamily)
    localStorage.setItem('editorFontFamily', fontFamily)
    // 선택된 텍스트가 있으면 해당 텍스트에 적용, 없으면 현재 커서 위치의 paragraph에 적용
    if (editor.state.selection.empty) {
      // 선택된 텍스트가 없으면 현재 paragraph에 적용
      editor.chain().focus().setFontFamily(fontFamily).run()
    } else {
      // 선택된 텍스트에 적용
      editor.chain().focus().setFontFamily(fontFamily).run()
    }
    setIsFontMenuOpen(false)
  }

  const handleFontSizeChange = (size: number) => {
    setCurrentFontSize(size)
    editor.chain().focus().setFontSize(size).run()
    setIsFontSizeMenuOpen(false)
  }

  const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 36, 40, 48]

  // 폰트 변경 시 에디터 스타일 업데이트
  useEffect(() => {
    if (editor) {
      const editorElement = editor.view.dom as HTMLElement
      if (editorElement) {
        editorElement.style.fontFamily = `${currentFont}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`
      }
      // 에디터 옵션 업데이트
      editor.setOptions({
        editorProps: {
          attributes: {
            class: 'focus:outline-none min-h-[400px]',
            style: `${editorStyle} padding: 24px;`,
          },
        },
      })
    }
  }, [currentFont, editor, editorStyle])

  // 첫 줄 들여쓰기, 문단 간격, 본문 폭 CSS 적용
  useEffect(() => {
    if (!editor) return
    
    const editorElement = editor.view.dom as HTMLElement
    if (!editorElement) return

    // CSS 변수로 설정 (모바일에서는 본문 폭 무시)
    const indentValue = firstLineIndent === 'none' ? '0' : firstLineIndent === '0.5' ? '0.5em' : firstLineIndent === '1' ? '1em' : '2em'
    const spacingValue = paragraphSpacing === 'none' ? '0' : paragraphSpacing === '0.5' ? '0.5em' : paragraphSpacing === '1' ? '1em' : '2em'
    const bodyWidthValue = bodyWidth && !isMobile ? `${bodyWidth}px` : 'none'
    
    editorElement.style.setProperty('--first-line-indent', indentValue)
    editorElement.style.setProperty('--paragraph-spacing', spacingValue)
    editorElement.style.setProperty('--body-width', bodyWidthValue)
    
    // 동적 스타일 태그 추가
    const styleId = 'episode-editor-body-settings'
    let styleTag = document.getElementById(styleId) as HTMLStyleElement
    if (!styleTag) {
      styleTag = document.createElement('style')
      styleTag.id = styleId
      document.head.appendChild(styleTag)
    }
    
    // 모바일에서는 본문 폭 무시
    const widthStyles = bodyWidth && !isMobile ? `width: ${bodyWidth}px !important; max-width: ${bodyWidth}px !important;` : ''
    
    // text-indent는 요소의 너비에 영향을 주지 않아야 함 (양쪽 정렬 시 모든 줄의 너비가 동일해야 함)
    styleTag.textContent = `
      .ProseMirror p {
        text-indent: var(--first-line-indent, 0);
        margin-bottom: var(--paragraph-spacing, 0);
        ${widthStyles}
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
      }
      .ProseMirror p:last-child {
        margin-bottom: 0;
      }
      .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4, .ProseMirror h5, .ProseMirror h6 {
        ${widthStyles}
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
      }
    `
  }, [editor, firstLineIndent, paragraphSpacing, bodyWidth, isMobile])

  // 폰트 크기 드롭다운 열 때 선택된 항목을 중앙으로 스크롤
  useEffect(() => {
    if (isFontSizeMenuOpen && fontSizeMenuContainerRef.current) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 스크롤
      setTimeout(() => {
        const activeButton = fontSizeMenuContainerRef.current?.querySelector(`[data-size="${currentFontSize}"]`) as HTMLElement
        if (activeButton && fontSizeMenuContainerRef.current) {
          const container = fontSizeMenuContainerRef.current
          const containerHeight = container.clientHeight
          const buttonOffsetTop = activeButton.offsetTop
          const buttonHeight = activeButton.offsetHeight
          const scrollPosition = buttonOffsetTop - (containerHeight / 2) + (buttonHeight / 2)
          container.scrollTop = scrollPosition
        }
      }, 0)
    }
  }, [isFontSizeMenuOpen, currentFontSize])

  // 폰트 드롭다운 열 때 선택된 항목을 중앙으로 스크롤
  useEffect(() => {
    if (isFontMenuOpen && fontMenuContainerRef.current) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 스크롤
      setTimeout(() => {
        const activeButton = fontMenuContainerRef.current?.querySelector(`[data-font="${currentFont}"]`) as HTMLElement
        if (activeButton && fontMenuContainerRef.current) {
          const container = fontMenuContainerRef.current
          const containerHeight = container.clientHeight
          const buttonOffsetTop = activeButton.offsetTop
          const buttonHeight = activeButton.offsetHeight
          const scrollPosition = buttonOffsetTop - (containerHeight / 2) + (buttonHeight / 2)
          container.scrollTop = scrollPosition
        }
      }, 0)
    }
  }, [isFontMenuOpen, currentFont])

  if (!editor) {
    return <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4 min-h-[400px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">로딩 중...</div>
  }

  return (
    <div 
      className={isWritingMode ? "bg-white dark:bg-gray-800" : "border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800"}
      style={{ '--editor-font-family': `${currentFont}, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif` } as React.CSSProperties}
    >
      {/* Toolbar */}
      <div className={`border-b border-gray-200 dark:border-gray-700 p-2 flex gap-1 flex-wrap items-center justify-between ${isWritingMode ? 'w-full' : ''}`}>
        <div className="flex gap-1 items-center flex-wrap">
          <div className="relative" ref={fontMenuRef}>
          <button
            onClick={() => setIsFontMenuOpen(!isFontMenuOpen)}
            className="px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            type="button"
          >
            <span style={{ fontFamily: currentFont }}>{getCurrentFontLabel()}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {isFontMenuOpen && (
            <div 
              ref={fontMenuContainerRef}
              className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[120px] overflow-y-auto max-h-[300px]"
            >
              {fonts.map((font) => {
                const isActive = currentFont === font.name
                
                return (
                  <button
                    key={font.name}
                    onClick={() => handleFontChange(font.name)}
                    className={`w-full text-center px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    style={{ fontFamily: font.name }}
                    type="button"
                    data-font={font.name}
                  >
                    <span>{font.label}</span>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="relative" ref={fontSizeMenuRef}>
          <button
            onClick={() => setIsFontSizeMenuOpen(!isFontSizeMenuOpen)}
            className="px-3 py-1.5 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-1.5"
            type="button"
          >
            <span>{currentFontSize}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {isFontSizeMenuOpen && (
            <div 
              ref={fontSizeMenuContainerRef}
              className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[100px] max-h-[300px] overflow-y-auto"
            >
              {fontSizes.map((size) => {
                const isActive = currentFontSize === size
                
                return (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={`w-full text-center px-4 py-2.5 text-sm flex items-center justify-center gap-2 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    type="button"
                    data-size={size}
                  >
                    <span>{size}</span>
                    {isActive && <Check className="w-4 h-4" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="w-px h-6 bg-gray-300 dark:bg-gray-600 mx-1"></div>
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
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
          className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
            editor.isActive('italic')
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          type="button"
        >
          <em>I</em>
        </button>
        <div className="relative" ref={listMenuRef}>
          <button
            onClick={() => setIsListMenuOpen(!isListMenuOpen)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              editor.isActive('bulletList') || editor.isActive('orderedList')
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            type="button"
          >
            • 목록
          </button>
          {isListMenuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[180px] overflow-hidden">
              <button
                onClick={() => {
                  editor.chain().focus().toggleBulletList().run()
                  setIsListMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  editor.isActive('bulletList')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <span className="text-base">•</span>
                <span>순서 없는 목록</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().toggleOrderedList().run()
                  setIsListMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  editor.isActive('orderedList')
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <span className="text-xs font-mono">1 2 3</span>
                <span>순서 있는 목록</span>
              </button>
            </div>
          )}
        </div>
        <div className="relative" ref={alignMenuRef}>
          <button
            onClick={() => setIsAlignMenuOpen(!isAlignMenuOpen)}
            className="px-3 py-1.5 rounded text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            type="button"
          >
            {(() => {
              const textAlign = editor.getAttributes('paragraph').textAlign || 
                                editor.getAttributes('heading').textAlign || 
                                'left'
              
              switch (textAlign) {
                case 'center':
                  return <AlignCenter className="w-4 h-4" />
                case 'right':
                  return <AlignRight className="w-4 h-4" />
                case 'justify':
                  return <AlignJustify className="w-4 h-4" />
                default:
                  return <AlignLeft className="w-4 h-4" />
              }
            })()}
          </button>
          {isAlignMenuOpen && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[160px] overflow-hidden">
              <button
                onClick={() => {
                  editor.chain().focus().setTextAlign('left').run()
                  setIsAlignMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  (editor.getAttributes('paragraph').textAlign === 'left' ||
                    editor.getAttributes('heading').textAlign === 'left' ||
                    (!editor.getAttributes('paragraph').textAlign && !editor.getAttributes('heading').textAlign))
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <AlignLeft className="w-4 h-4" />
                <span>왼쪽 정렬</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setTextAlign('center').run()
                  setIsAlignMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  editor.getAttributes('paragraph').textAlign === 'center' ||
                  editor.getAttributes('heading').textAlign === 'center'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <AlignCenter className="w-4 h-4" />
                <span>가운데 정렬</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setTextAlign('right').run()
                  setIsAlignMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  editor.getAttributes('paragraph').textAlign === 'right' ||
                  editor.getAttributes('heading').textAlign === 'right'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <AlignRight className="w-4 h-4" />
                <span>오른쪽 정렬</span>
              </button>
              <button
                onClick={() => {
                  editor.chain().focus().setTextAlign('justify').run()
                  setIsAlignMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                  editor.getAttributes('paragraph').textAlign === 'justify' ||
                  editor.getAttributes('heading').textAlign === 'justify'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                type="button"
              >
                <AlignJustify className="w-4 h-4" />
                <span>양쪽 정렬</span>
              </button>
            </div>
          )}
        </div>
        </div>
        {isWritingMode && (
          <div className="flex items-center gap-2 ml-auto">
            {onShowBodySettings && (
              <button
                onClick={onShowBodySettings}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors rounded ${
                  showBodySettings 
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' 
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Settings2 className="w-4 h-4" />
                본문 설정
              </button>
            )}
            {wordCounts && (
              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span>공포: {wordCounts.withSpaces.toLocaleString()}자</span>
                <span>공미포: {wordCounts.withoutSpaces.toLocaleString()}자</span>
              </div>
            )}
            {onSave && (
              <button
                onClick={onSave}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors rounded"
              >
                {isSaving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            )}
            {onExitWritingMode && (
              <button
                onClick={onExitWritingMode}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors rounded"
              >
                <Minimize2 className="w-4 h-4" />
                종료
              </button>
            )}
          </div>
        )}
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  )
})

export default SynopsisEditor

