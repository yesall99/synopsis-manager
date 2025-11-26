import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, Loader2, Edit2 } from 'lucide-react'
import { useEpisodeStore } from '@/stores/episodeStore'
import { useChapterStore } from '@/stores/chapterStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import SynopsisEditor from '@/components/SynopsisEditor'

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
  const [publishedAt, setPublishedAt] = useState<string>('')
  const [subscriberCount, setSubscriberCount] = useState<number | undefined>(undefined)
  const [viewCount, setViewCount] = useState<number | undefined>(undefined)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(isNew) // 새 항목은 바로 편집 모드
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
    }
  }, [currentEpisode, isNew])

  const startEdit = () => {
    setEditData({ episodeNumber, title, chapterId, content, publishedAt, subscriberCount, viewCount })
    setIsEditing(true)
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

  // 다음 회차가 있는지 확인 (다음 회차가 있으면 선작수/조회수 입력 불가)
  const hasNextEpisode = episodes.some(
    (e) => e.workId === workId && e.episodeNumber > episodeNumber
  )
  const canEditStats = !hasNextEpisode

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const wordCount = calculateWordCount(content)
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
          content: content.trim(),
          wordCount,
          publishedAt: publishedDate,
          subscriberCount: subscriberCount,
          viewCount: viewCount,
          order: maxOrder + 1,
        })
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } else if (id) {
        await updateEpisode(id, {
          episodeNumber,
          title: title.trim() || undefined,
          chapterId: chapterId || undefined,
          content: content.trim(),
          wordCount,
          publishedAt: publishedDate,
          subscriberCount: subscriberCount,
          viewCount: viewCount,
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
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

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

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 break-words">
              {isNew ? '새 회차' : (isNew || isEditing) ? '회차 편집' : `제 ${episodeNumber}화: ${title || '(제목 없음)'}`}
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
                className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Chapter */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">장</label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
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
                className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>

            {/* Published Date */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">발행일</label>
              <input
                type="date"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
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
                      className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
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
                      className="w-full px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Content */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">내용</label>
              <SynopsisEditor content={content} onChange={setContent} placeholder="회차 내용을 작성하세요..." />
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
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">회차 제목</label>
              <p className="text-base text-gray-900 dark:text-gray-100">{title || '(제목 없음)'}</p>
            </div>

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
            {currentEpisode?.wordCount && (
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">글자 수</label>
                <p className="text-base text-gray-900 dark:text-gray-100">{currentEpisode.wordCount.toLocaleString()}자</p>
              </div>
            )}

            {/* Content */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-3">내용</label>
              <div className="prose prose-sm max-w-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-6 min-h-[400px]">
                {content ? (
                  <div dangerouslySetInnerHTML={{ __html: content }} />
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

