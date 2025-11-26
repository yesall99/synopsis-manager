import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, Loader2 } from 'lucide-react'
import { useChapterStore } from '@/stores/chapterStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import type { ChapterStructureType } from '@/types'

export default function ChapterEdit() {
  const { workId, id } = useParams<{ workId: string; id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const {
    currentChapter,
    isLoading,
    error,
    chapters,
    loadChapters,
    loadChapter,
    createChapter,
    updateChapter,
    deleteChapter,
    clearCurrentChapter,
  } = useChapterStore()

  const [title, setTitle] = useState('')
  const [structureType, setStructureType] = useState<ChapterStructureType>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(isNew) // 새 항목은 바로 편집 모드
  
  // isNew일 때는 항상 편집 모드
  const effectiveIsEditing = isNew ? true : isEditing
  const [editData, setEditData] = useState({
    title: '',
    structureType: null as ChapterStructureType,
  })

  useEffect(() => {
    if (workId) {
      loadChapters()
    }
  }, [workId, loadChapters])

  useEffect(() => {
    if (isNew) {
      clearCurrentChapter()
      setTitle('')
      setStructureType(null)
      setIsEditing(true) // 새 항목은 바로 편집 모드
    } else if (id) {
      loadChapter(id).then(() => {
        setIsEditing(false) // 기존 항목은 보기 모드로 시작
      })
    }
  }, [id, isNew, loadChapter, clearCurrentChapter])

  useEffect(() => {
    if (currentChapter && !isNew) {
      setTitle(currentChapter.title)
      setStructureType(currentChapter.structureType || null)
    }
  }, [currentChapter, isNew])

  const startEdit = () => {
    setEditData({ title, structureType })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    if (isNew) return
    setTitle(editData.title)
    setStructureType(editData.structureType)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      alert('장 제목을 입력해주세요.')
      return
    }
    if (!workId) {
      alert('작품 ID가 없습니다.')
      return
    }

    setIsSaving(true)
    try {
      if (isNew) {
        const sameWorkChapters = chapters.filter((c) => c.workId === workId)
        const maxOrder = sameWorkChapters.length > 0
          ? Math.max(...sameWorkChapters.map((c) => c.order ?? 0))
          : -1

        await createChapter({
          workId,
          title: title.trim(),
          structureType: structureType || undefined,
          order: maxOrder + 1,
        })
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } else if (id) {
        await updateChapter(id, {
          title: title.trim(),
          structureType: structureType || undefined,
        })
        setIsEditing(false)
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

    if (confirm('정말 이 장을 삭제하시겠습니까? 장에 속한 회차는 삭제되지 않습니다.')) {
      try {
        await deleteChapter(id)
        navigate(`/works/${workId}`, { state: { tab: 'episodes' } })
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-700">{error}</p>
        </div>
        <button
          onClick={() => navigate(`/works/${workId}`, { state: { tab: 'episodes' } })}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          장 목록으로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate(`/works/${workId}`, { state: { tab: 'episodes' } })}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            작품으로 돌아가기
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              {isNew ? '새 장' : (isNew || isEditing) ? '장 편집' : currentChapter?.title || '(제목 없음)'}
            </h1>
            {!isNew && !(isNew || isEditing) && (
              <div className="flex gap-2">
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Save className="w-4 h-4" />
                  편집
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">장 제목</label>
            {(isNew || isEditing) ? (
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-700">{title || '(제목 없음)'}</p>
            )}
          </div>

          {/* Structure Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">구조 구분</label>
            {(isNew || isEditing) ? (
              <select
                value={structureType || ''}
                onChange={(e) => setStructureType(e.target.value === '' ? null : (e.target.value as ChapterStructureType))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">구분 없음</option>
                <option value="gi">기</option>
                <option value="seung">승</option>
                <option value="jeon">전</option>
                <option value="gyeol">결</option>
              </select>
            ) : (
              <p className="text-gray-700">
                {structureType === 'gi' ? '기' :
                 structureType === 'seung' ? '승' :
                 structureType === 'jeon' ? '전' :
                 structureType === 'gyeol' ? '결' : '(없음)'}
              </p>
            )}
          </div>

          {(isNew || isEditing) && (
            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                저장
              </button>
              {!isNew && (
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

