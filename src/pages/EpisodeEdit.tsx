import { useEffect, useState, useMemo, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, Loader2, Edit2, Maximize2, Minimize2, Settings2, AlignLeft, Indent, MoreVertical } from 'lucide-react'
import { useEpisodeStore } from '@/stores/episodeStore'
import { useChapterStore } from '@/stores/chapterStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import SynopsisEditor, { SynopsisEditorRef } from '@/components/SynopsisEditor'

export default function EpisodeEdit() {
  const { workId, id } = useParams<{ workId: string; id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const {
    currentEpisode,
    isLoading,
    error,
    loadEpisode,
    createEpisode,
    updateEpisode,
    deleteEpisode,
    clearCurrentEpisode,
    episodes,
  } = useEpisodeStore()
  const { chapters, loadChapters } = useChapterStore()

  const [episodeNumber, setEpisodeNumber] = useState(1)
  const [title, setTitle] = useState('')
  const [chapterId, setChapterId] = useState<string>('')
  const [content, setContent] = useState('')
  const contentViewRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<SynopsisEditorRef>(null)
  const [publishedAt, setPublishedAt] = useState<string>('')
  const [subscriberCount, setSubscriberCount] = useState<number | undefined>(undefined)
  const [viewCount, setViewCount] = useState<number | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(isNew) // 새 항목은 바로 편집 모드
  const [isWritingMode, setIsWritingMode] = useState(false) // 쓰기 모드
  const [showBodySettings, setShowBodySettings] = useState(false) // 본문 설정 사이드바 표시
  // 본문 설정 상태
  const [layoutMode, setLayoutMode] = useState<'scroll' | 'page'>('scroll')
  const [bodyWidth, setBodyWidth] = useState<400 | 600 | 800>(600)
  const [firstLineIndent, setFirstLineIndent] = useState<'none' | '0.5' | '1' | '2'>('1')
  const [paragraphSpacing, setParagraphSpacing] = useState<'none' | '0.5' | '1' | '2'>('1')
  const [editData, setEditData] = useState({
    episodeNumber: 1,
    title: '',
    chapterId: '',
    content: '',
    publishedAt: '',
    subscriberCount: undefined as number | undefined,
    viewCount: undefined as number | undefined,
  })

  // isNew일 때는 항상 편집 모드
  const effectiveIsEditing = isNew ? true : isEditing

  // ESC 키로 쓰기 모드 종료
  useEffect(() => {
    if (!isWritingMode) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsWritingMode(false)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isWritingMode])

  // 보기 모드에서 폰트 및 본문 설정 적용
  useEffect(() => {
    if (!content || isEditing) return
    
    // 모바일 감지
    const isMobile = window.innerWidth < 768 // md breakpoint
    
    const applyStyles = () => {
      if (!contentViewRef.current) return
      
      // episode-content-view 내부의 모든 요소 확인
      if (!contentViewRef.current) return
      
      // DOM이 아직 준비되지 않았으면 재시도
      const elements = contentViewRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
      if (elements.length === 0) return
      
      // content 변수에서 font-family 찾기 (HTML에 저장된 원본 데이터)
      let detectedFont: string | null = null
      
      // content에서 font-family 패턴 찾기
      const fontFamilyPatterns = [
        /font-family\s*:\s*['"]?([^;'"]+)['"]?/gi,
        /font-family\s*:\s*([^;]+)/gi
      ]
      
      for (const pattern of fontFamilyPatterns) {
        const matches = content.match(pattern)
        if (matches && matches.length > 0) {
          const firstMatch = matches[0]
          const fontMatch = firstMatch.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/i)
          if (fontMatch) {
            let fontFamily = fontMatch[1].trim()
            // 따옴표 제거
            fontFamily = fontFamily.replace(/^['"]|['"]$/g, '')
            // 콤마로 구분된 경우 첫 번째 값만 사용
            if (fontFamily.includes(',')) {
              fontFamily = fontFamily.split(',')[0].trim()
            }
            detectedFont = fontFamily.toLowerCase()
            break
          }
        }
      }
      
      // content에서 찾지 못했으면 DOM에서도 확인
      if (!detectedFont) {
        const htmlContent = contentViewRef.current.innerHTML || ''
        for (const pattern of fontFamilyPatterns) {
          const matches = htmlContent.match(pattern)
          if (matches && matches.length > 0) {
            const firstMatch = matches[0]
            const fontMatch = firstMatch.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/i)
            if (fontMatch) {
              let fontFamily = fontMatch[1].trim()
              fontFamily = fontFamily.replace(/^['"]|['"]$/g, '')
              if (fontFamily.includes(',')) {
                fontFamily = fontFamily.split(',')[0].trim()
              }
              detectedFont = fontFamily.toLowerCase()
              break
            }
          }
        }
      }
      
      // 모든 p, h1-h6 요소에 폰트 및 폰트 크기 적용
      const textElements = contentViewRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
      textElements.forEach((el) => {
        const htmlEl = el as HTMLElement
        const styleAttr = htmlEl.getAttribute('style') || ''
        
        // 요소의 style 속성에서 font-family 찾기
        let elementFont: string | null = null
        if (styleAttr && styleAttr.includes('font-family')) {
          const fontMatch = styleAttr.match(/font-family\s*:\s*['"]?([^;'"]+)['"]?/i)
          if (fontMatch) {
            let fontFamily = fontMatch[1].trim()
            fontFamily = fontFamily.replace(/^['"]|['"]$/g, '')
            if (fontFamily.includes(',')) {
              fontFamily = fontFamily.split(',')[0].trim()
            }
            elementFont = fontFamily.toLowerCase()
          }
        }
        
        // 요소에 font-family가 있으면 그것을 사용, 없으면 HTML 전체에서 찾은 폰트 사용, 그것도 없으면 localStorage에서 가져오기
        let fontToUse = elementFont || detectedFont
        if (!fontToUse) {
          // localStorage에서 마지막 사용 폰트 가져오기
          const savedFont = localStorage.getItem('editorFontFamily') || 'Pretendard'
          fontToUse = savedFont.toLowerCase()
        }
        
        if (fontToUse) {
          let targetFont = ''
          if (fontToUse.includes('ridibatang')) {
            targetFont = "'Ridibatang', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Fira Sans\", \"Droid Sans\", \"Helvetica Neue\", sans-serif"
          } else if (fontToUse.includes('pretendard')) {
            targetFont = "'Pretendard', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Oxygen, Ubuntu, Cantarell, \"Fira Sans\", \"Droid Sans\", \"Helvetica Neue\", sans-serif"
          }
          
          if (targetFont) {
            // 직접 style 객체에 설정 (가장 확실한 방법)
            htmlEl.style.fontFamily = targetFont
            // setProperty로 important 플래그와 함께 적용
            htmlEl.style.setProperty('font-family', targetFont, 'important')
          }
        }
        
        // 폰트 크기가 명시적으로 설정되지 않은 경우 기본값 18px 적용
        const hasFontSize = htmlEl.querySelector('span[data-font-size]') !== null || styleAttr.includes('font-size')
        if (!hasFontSize) {
          htmlEl.style.setProperty('font-size', '18px', 'important')
        }
        
        // line-height는 항상 1.8로 설정
        htmlEl.style.setProperty('line-height', '1.8', 'important')
      })
      
      // span 요소들에도 폰트 크기 및 line-height 적용
      const spanElements = contentViewRef.current.querySelectorAll('span')
      spanElements.forEach((el) => {
        const htmlSpan = el as HTMLElement
        // data-font-size가 없는 span은 기본값 18px 적용
        if (!htmlSpan.hasAttribute('data-font-size') && !htmlSpan.style.fontSize) {
          htmlSpan.style.setProperty('font-size', '18px', 'important')
        }
        // line-height는 항상 1.8로 설정
        htmlSpan.style.setProperty('line-height', '1.8', 'important')
      })
      
      // 본문 설정 적용: 첫 줄 들여쓰기, 문단 간격, 정렬, 본문 폭
      const paragraphs = contentViewRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6')
      paragraphs.forEach((p) => {
        const htmlP = p as HTMLElement
        const styleAttr = htmlP.getAttribute('style') || ''
        
        // text-align 속성 확인 및 유지 (HTML에 이미 저장된 정렬 정보)
        if (styleAttr.includes('text-align')) {
          const alignMatch = styleAttr.match(/text-align\s*:\s*([^;]+)/i)
          if (alignMatch) {
            const alignValue = alignMatch[1].trim()
            htmlP.style.setProperty('text-align', alignValue, 'important')
          }
        }
        
        // 첫 줄 들여쓰기
        let indentValue = '0'
        if (firstLineIndent !== 'none') {
          indentValue = firstLineIndent === '0.5' ? '0.5em' : firstLineIndent === '1' ? '1em' : '2em'
          htmlP.style.setProperty('text-indent', indentValue, 'important')
        } else {
          htmlP.style.setProperty('text-indent', '0', 'important')
        }
        
        // 문단 간격
        if (paragraphSpacing !== 'none') {
          const spacingValue = paragraphSpacing === '0.5' ? '0.5em' : paragraphSpacing === '1' ? '1em' : '2em'
          htmlP.style.setProperty('margin-bottom', spacingValue, 'important')
        } else {
          htmlP.style.setProperty('margin-bottom', '0', 'important')
        }
        
        // 본문 폭 (모바일에서는 무시, text-indent는 요소의 너비에 영향을 주지 않아야 함 - 양쪽 정렬 시 모든 줄의 너비가 동일해야 함)
        if (bodyWidth && !isMobile) {
          htmlP.style.setProperty('box-sizing', 'border-box', 'important')
          htmlP.style.setProperty('width', `${bodyWidth}px`, 'important')
          htmlP.style.setProperty('max-width', `${bodyWidth}px`, 'important')
          htmlP.style.setProperty('margin-left', 'auto', 'important')
          htmlP.style.setProperty('margin-right', 'auto', 'important')
        } else if (isMobile) {
          // 모바일에서는 본문 폭 제거
          htmlP.style.removeProperty('width')
          htmlP.style.removeProperty('max-width')
          htmlP.style.removeProperty('margin-left')
          htmlP.style.removeProperty('margin-right')
        }
      })
    }
    
    // DOM이 준비될 때까지 기다리는 함수
    const waitForDOM = (callback: () => void, maxAttempts = 20, attempt = 0) => {
      if (contentViewRef.current && contentViewRef.current.querySelectorAll('p, h1, h2, h3, h4, h5, h6').length > 0) {
        callback()
      } else if (attempt < maxAttempts) {
        setTimeout(() => waitForDOM(callback, maxAttempts, attempt + 1), 50)
      }
    }
    
    // 즉시 적용 및 여러 번 시도 (DOM 렌더링 타이밍 문제 해결)
    waitForDOM(applyStyles) // DOM 준비 대기 후 적용
    const timeout1 = setTimeout(() => waitForDOM(applyStyles), 0)
    const timeout2 = setTimeout(() => waitForDOM(applyStyles), 100)
    const timeout3 = setTimeout(() => waitForDOM(applyStyles), 300)
    const timeout4 = setTimeout(() => waitForDOM(applyStyles), 500)
    const timeout5 = setTimeout(() => waitForDOM(applyStyles), 1000)
    
    // requestAnimationFrame을 사용하여 브라우저 렌더링 후 적용
    const rafId1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        waitForDOM(applyStyles)
      })
    })
    
    const rafId2 = requestAnimationFrame(() => {
      setTimeout(() => {
        requestAnimationFrame(() => {
          waitForDOM(applyStyles)
        })
      }, 100)
    })
    
    // DOM 변경 감지를 위한 MutationObserver (childList만 감지하여 무한 루프 방지)
    const observer = new MutationObserver((mutations) => {
      // childList 변경만 감지 (style 속성 변경은 감지하지 않음)
      const hasChildListChange = mutations.some(mutation => mutation.type === 'childList')
      if (hasChildListChange) {
        waitForDOM(applyStyles)
      }
    })
    
    // contentViewRef가 준비될 때까지 기다린 후 observer 설정
    const setupObserver = () => {
      if (contentViewRef.current) {
        observer.observe(contentViewRef.current, {
          childList: true,
          subtree: true,
          // attributes는 제거하여 무한 루프 방지
        })
      } else {
        setTimeout(setupObserver, 50)
      }
    }
    setupObserver()
    
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId1)
      cancelAnimationFrame(rafId2)
      clearTimeout(timeout1)
      clearTimeout(timeout2)
      clearTimeout(timeout3)
      clearTimeout(timeout4)
      clearTimeout(timeout5)
    }
  }, [content, isEditing, firstLineIndent, paragraphSpacing, bodyWidth, layoutMode])

  useEffect(() => {
    if (workId) {
      loadChapters()
    }
  }, [workId, loadChapters])

  useEffect(() => {
    if (isNew) {
      clearCurrentEpisode()
      // 새 회차 번호는 기존 회차 중 최대값 + 1
      const sameWorkEpisodes = episodes.filter((e) => e.workId === workId)
      const maxEpisodeNumber = sameWorkEpisodes.length > 0
        ? Math.max(...sameWorkEpisodes.map((e) => e.episodeNumber))
        : 0
      setEpisodeNumber(maxEpisodeNumber + 1)
      setTitle('')
      setChapterId('')
      setContent('')
      setPublishedAt('')
      setSubscriberCount(undefined)
      setViewCount(undefined)
      setIsEditing(true) // 새 항목은 바로 편집 모드
    } else if (id) {
      loadEpisode(id).then(() => {
        setIsEditing(false) // 기존 항목은 보기 모드로 시작
      })
    }
  }, [id, isNew, workId, loadEpisode, clearCurrentEpisode, episodes])

  useEffect(() => {
    if (currentEpisode && !isNew) {
      setEpisodeNumber(currentEpisode.episodeNumber)
      setTitle(currentEpisode.title || '')
      setChapterId(currentEpisode.chapterId || '')
      setContent(currentEpisode.content)
      setPublishedAt(
        currentEpisode.publishedAt ? new Date(currentEpisode.publishedAt).toISOString().split('T')[0] : ''
      )
      setSubscriberCount(currentEpisode.subscriberCount)
      setViewCount(currentEpisode.viewCount)
      // 본문 설정 불러오기
      setLayoutMode(currentEpisode.layoutMode || 'scroll')
      setBodyWidth(currentEpisode.bodyWidth || 600)
      setFirstLineIndent(currentEpisode.firstLineIndent || '1')
      setParagraphSpacing(currentEpisode.paragraphSpacing || '1')
    }
  }, [currentEpisode, isNew])

  const startEdit = () => {
    setEditData({ episodeNumber, title, chapterId, content, publishedAt, subscriberCount, viewCount })
    setIsEditing(true)
  }

  // 본문 설정 저장
  const handleBodySettingsChange = () => {
    // 설정이 변경되면 자동으로 저장 (또는 저장 버튼 클릭 시 함께 저장)
    // 여기서는 저장 시 함께 저장하도록 함
  }

  const cancelEdit = () => {
    if (isNew) return
    setEpisodeNumber(editData.episodeNumber)
    setTitle(editData.title)
    setChapterId(editData.chapterId)
    setContent(editData.content)
    setPublishedAt(editData.publishedAt)
    setSubscriberCount(editData.subscriberCount)
    setViewCount(editData.viewCount)
    setIsEditing(false)
  }

  const calculateWordCount = (html: string): number => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    const text = tempDiv.textContent || tempDiv.innerText || ''
    return text.length
  }

  // 실시간 글자수 계산 (공백 포함/미포함)
  const wordCounts = useMemo(() => {
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = content
    const text = tempDiv.textContent || tempDiv.innerText || ''
    const withSpaces = text.length
    const withoutSpaces = text.replace(/\s/g, '').length
    return { withSpaces, withoutSpaces }
  }, [content])

  // 다음 회차가 있는지 확인 (다음 회차가 있으면 선작수/조회수 입력 불가)
  const hasNextEpisode = episodes.some(
    (e) => e.workId === workId && e.episodeNumber > episodeNumber
  )
  const canEditStats = !hasNextEpisode

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // 저장 시점에 에디터에서 최신 content 가져오기 (debounce 문제 해결)
      const latestContent = editorRef.current?.getContent() || content
      
      // 공백 포함 글자수로 저장 (최신 content 기준)
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = latestContent
      const text = tempDiv.textContent || tempDiv.innerText || ''
      const wordCount = text.length
      const publishedDate = publishedAt ? new Date(publishedAt) : undefined

      if (isNew) {
        if (!workId) {
          alert('작품 ID가 없습니다.')
          return
        }
        // 같은 workId의 회차 중 최대 order 찾기
        const sameWorkEpisodes = episodes.filter((e) => e.workId === workId)
        const maxOrder = sameWorkEpisodes.length > 0
          ? Math.max(...sameWorkEpisodes.map((e) => e.order ?? 0))
          : -1

        const newEpisode = await createEpisode({
          workId,
          episodeNumber,
          title: title.trim() || undefined,
          chapterId: chapterId || undefined,
          content: latestContent.trim(),
          wordCount,
          publishedAt: publishedDate,
          subscriberCount: subscriberCount,
          viewCount: viewCount,
          order: maxOrder + 1,
          layoutMode,
          bodyWidth,
          firstLineIndent,
          paragraphSpacing,
        })
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } else if (id) {
        await updateEpisode(id, {
          episodeNumber,
          title: title.trim() || undefined,
          chapterId: chapterId || undefined,
          content: latestContent.trim(),
          wordCount,
          publishedAt: publishedDate,
          subscriberCount: subscriberCount,
          viewCount: viewCount,
          layoutMode,
          bodyWidth,
          firstLineIndent,
          paragraphSpacing,
        })
        setIsEditing(false) // 저장 후 보기 모드로
      }
      
      // 노션 동기화 (백그라운드)
      syncToNotionInBackground().catch(console.error)
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || isNew) return

    if (confirm('정말 이 회차를 삭제하시겠습니까?')) {
      try {
        await deleteEpisode(id)
        // 삭제 후 노션 동기화
        syncToNotionInBackground().catch(console.error)
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  // 모바일 감지
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768) // md breakpoint
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // 본문 설정 스타일 계산 (모든 hooks는 early return 전에 호출되어야 함)
  const bodyStyles = useMemo(() => {
    const styles: React.CSSProperties = {
      // 모바일에서는 본문 폭 무시
      ...(bodyWidth && !isMobile ? { maxWidth: `${bodyWidth}px`, margin: '0 auto' } : {}),
    }
    
    // 첫 줄 들여쓰기
    if (firstLineIndent !== 'none') {
      const indentValue = firstLineIndent === '0.5' ? '0.5em' : firstLineIndent === '1' ? '1em' : '2em'
      styles.textIndent = indentValue
    }
    
    // 문단 사이 간격
    if (paragraphSpacing !== 'none') {
      const spacingValue = paragraphSpacing === '0.5' ? '0.5em' : paragraphSpacing === '1' ? '1em' : '2em'
      styles.marginBottom = spacingValue
    }
    
    return styles
  }, [bodyWidth, firstLineIndent, paragraphSpacing, isMobile])

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  if (error && !isNew) {
    return (
      <div className="p-8 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={() => navigate(`/works/${workId}`, { state: { tab: 'episodes' } })}
            className="mt-4 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800"
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  // 쓰기 모드일 때는 간단한 레이아웃
  if (isWritingMode && (isNew || isEditing)) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-800 flex flex-col">
        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* 본문 영역 */}
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-800">
            <div className="w-full">
              <SynopsisEditor 
                ref={editorRef}
                content={content} 
                onChange={setContent} 
                placeholder="회차 내용을 작성하세요..."
                bodyWidth={bodyWidth}
                firstLineIndent={firstLineIndent}
                paragraphSpacing={paragraphSpacing}
                isWritingMode={true}
                onSave={handleSave}
                isSaving={isSaving}
                wordCounts={wordCounts}
                onShowBodySettings={() => setShowBodySettings(!showBodySettings)}
                showBodySettings={showBodySettings}
                onExitWritingMode={() => setIsWritingMode(false)}
              />
            </div>
          </div>

          {/* 본문 설정 사이드바 - 모바일: 오버레이, 데스크톱: 사이드바 */}
          {showBodySettings && (
            <>
              {/* 모바일: 배경 오버레이 */}
              <div 
                className="fixed inset-0 bg-black/50 dark:bg-black/60 z-40 md:hidden"
                onClick={() => setShowBodySettings(false)}
              />
              
              {/* 사이드바 */}
              <div className="fixed md:relative inset-y-0 right-0 md:right-auto w-full sm:w-80 md:w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-y-auto z-50 md:z-auto">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-6 md:mb-6">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">본문 설정</h2>
                    </div>
                    {/* 모바일에서만 닫기 버튼 표시 */}
                    <button
                      onClick={() => setShowBodySettings(false)}
                      className="md:hidden p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* 본문 폭 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <AlignLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">본문 폭</label>
                      </div>
                      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 shadow-sm w-full sm:w-auto">
                        {([400, 600, 800] as const).map((width, index) => (
                          <button
                            key={width}
                            onClick={() => setBodyWidth(width)}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 text-sm transition-all ${
                              bodyWidth === width
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                            } ${index === 0 ? '' : 'border-l border-gray-300 dark:border-gray-600'}`}
                          >
                            {width}px
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 첫 줄 들여쓰기 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Indent className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">첫 줄 들여쓰기</label>
                      </div>
                      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 shadow-sm w-full sm:w-auto">
                        {(['none', '0.5', '1', '2'] as const).map((indent, index) => (
                          <button
                            key={indent}
                            onClick={() => setFirstLineIndent(indent)}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-2 text-xs transition-all ${
                              firstLineIndent === indent
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                            } ${index === 0 ? '' : 'border-l border-gray-300 dark:border-gray-600'}`}
                          >
                            {indent === 'none' ? '없음' : indent === '0.5' ? '0.5칸' : indent === '1' ? '1칸' : '2칸'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 문단 사이 간격 */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MoreVertical className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        <label className="text-sm font-medium text-gray-900 dark:text-gray-100">문단 사이 간격</label>
                      </div>
                      <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden bg-white dark:bg-gray-800 shadow-sm w-full sm:w-auto">
                        {(['none', '0.5', '1', '2'] as const).map((spacing, index) => (
                          <button
                            key={spacing}
                            onClick={() => setParagraphSpacing(spacing)}
                            className={`flex-1 sm:flex-none px-2 sm:px-3 py-2 text-xs transition-all ${
                              paragraphSpacing === spacing
                                ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium shadow-sm'
                                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-750'
                            } ${index === 0 ? '' : 'border-l border-gray-300 dark:border-gray-600'}`}
                          >
                            {spacing === 'none' ? '없음' : spacing === '0.5' ? '0.5줄' : spacing === '1' ? '1줄' : '2줄'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 break-words">
              {isNew ? '새 회차' : (isNew || isEditing) ? '회차 편집' : title ? `제 ${episodeNumber}화: ${title}` : `제 ${episodeNumber}화`}
            </h1>
            {!isNew && !(isNew || isEditing) && (
              <div className="flex gap-2">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  편집
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {(isNew || isEditing) ? (
          <div className="space-y-6">
            {/* Episode Number */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">회차 번호</label>
              <input
                type="number"
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(parseInt(e.target.value) || 1)}
                min="1"
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Chapter */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">장</label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
              >
                <option value="">장 없음</option>
                {chapters
                  .filter((c) => c.workId === workId)
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">회차 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="회차 제목을 입력하세요"
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Published Date */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">발행일</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Subscriber Count & View Count - 다음 회차가 없을 때만 입력 가능 */}
            {canEditStats && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">선작수 (작품 전체)</label>
                    <input
                      type="number"
                      value={subscriberCount ?? ''}
                      onChange={(e) => setSubscriberCount(e.target.value ? parseInt(e.target.value) : undefined)}
                      min="0"
                      placeholder="선작수"
                      className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">조회수 (회차별)</label>
                    <input
                      type="number"
                      value={viewCount ?? ''}
                      onChange={(e) => setViewCount(e.target.value ? parseInt(e.target.value) : undefined)}
                      min="0"
                      placeholder="조회수"
                      className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs text-gray-500 dark:text-gray-400">내용</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                    <span>공포: {wordCounts.withSpaces.toLocaleString()}자</span>
                    <span>공미포: {wordCounts.withoutSpaces.toLocaleString()}자</span>
                  </div>
                  <button
                    onClick={() => setIsWritingMode(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                    title="쓰기 모드 (ESC로 종료)"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    쓰기 모드
                  </button>
                </div>
              </div>
              <SynopsisEditor 
                ref={editorRef}
                content={content} 
                onChange={setContent} 
                placeholder="회차 내용을 작성하세요..."
                bodyWidth={bodyWidth}
                firstLineIndent={firstLineIndent}
                paragraphSpacing={paragraphSpacing}
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              {!isNew && (
                <button
                  onClick={cancelEdit}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  취소
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    저장
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Episode Number */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">회차 번호</label>
              <p className="text-base text-gray-900 dark:text-gray-100">제 {episodeNumber}화</p>
            </div>

            {/* Chapter */}
            {chapterId && (() => {
              const chapter = chapters.find((c) => c.id === chapterId)
              return chapter ? (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">장</label>
                  <p className="text-base text-gray-900 dark:text-gray-100">{chapter.title}</p>
                </div>
              ) : null
            })()}

            {/* Title */}
            {title && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">회차 제목</label>
                <p className="text-base text-gray-900 dark:text-gray-100">{title}</p>
              </div>
            )}

            {/* Published Date */}
            {publishedAt && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">발행일</label>
                <p className="text-base text-gray-900 dark:text-gray-100">{new Date(publishedAt).toLocaleDateString('ko-KR')}</p>
              </div>
            )}

            {/* Subscriber Count & View Count */}
            {(subscriberCount !== undefined || viewCount !== undefined) && (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {subscriberCount !== undefined && (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">선작수 (작품 전체)</label>
                      <p className="text-base text-gray-900 dark:text-gray-100">{subscriberCount.toLocaleString()}</p>
                    </div>
                  )}
                  {viewCount !== undefined && (
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">조회수 (회차별)</label>
                      <p className="text-base text-gray-900 dark:text-gray-100">{viewCount.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Word Count */}
            {content && (() => {
              const tempDiv = document.createElement('div')
              tempDiv.innerHTML = content
              const text = tempDiv.textContent || tempDiv.innerText || ''
              const withSpaces = text.length
              const withoutSpaces = text.replace(/\s/g, '').length
              return (
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">글자 수</label>
                  <div className="flex items-center gap-4">
                    <p className="text-base text-gray-900 dark:text-gray-100">공포: {withSpaces.toLocaleString()}자</p>
                    <p className="text-base text-gray-900 dark:text-gray-100">공미포: {withoutSpaces.toLocaleString()}자</p>
                  </div>
                </div>
              )
            })()}

            {/* Content */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">내용</label>
              <div 
                className="prose prose-sm max-w-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg min-h-[400px]"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '24px',
                }}
              >
                {content ? (
                  <div 
                    ref={contentViewRef}
                    className="episode-content-view"
                    style={{
                      ...(bodyWidth && !isMobile ? { width: `${bodyWidth}px` } : {}),
                      maxWidth: '100%',
                    }}
                    dangerouslySetInnerHTML={{ __html: content }} 
                  />
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 text-center">내용이 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

