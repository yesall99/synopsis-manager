import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Save, ArrowLeft, Loader2, X } from 'lucide-react'
import { useSynopsisStore } from '@/stores/synopsisStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import SynopsisStructureEditor from '@/components/SynopsisStructureEditor'
import type { SynopsisStructure } from '@/types'

export default function SynopsisEdit() {
  const { workId, id } = useParams<{ workId: string; id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  
  const {
    currentSynopsis,
    isLoading,
    error,
    loadSynopsis,
    createSynopsis,
    updateSynopsis,
    clearCurrentSynopsis,
  } = useSynopsisStore()

  const [structure, setStructure] = useState<SynopsisStructure>({
    gi: [],
    seung: [],
    jeon: [],
    gyeol: [],
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(true) // 항상 편집 모드

  useEffect(() => {
    if (isNew) {
      if (!workId) {
        navigate(`/works/${workId}`)
        return
      }
      clearCurrentSynopsis()
      setStructure({ gi: [], seung: [], jeon: [], gyeol: [] })
      setIsEditing(true) // 새 항목은 바로 편집 모드
    } else if (id) {
      loadSynopsis(id)
      setIsEditing(true) // 항상 편집 모드로 시작
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, workId, isNew, navigate])

  useEffect(() => {
    if (currentSynopsis && !isNew) {
      setStructure(currentSynopsis.structure || { gi: [], seung: [], jeon: [], gyeol: [] })
    }
  }, [currentSynopsis, isNew])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const synopsisData = {
        structure: structure, // 항상 구조 사용
        characterIds: [],
        settingIds: [],
      }

      if (isNew) {
        if (!workId) {
          alert('작품 ID가 없습니다.')
          return
        }
        await createSynopsis({ ...synopsisData, workId })
        navigate(`/works/${workId}`)
      } else if (id) {
        await updateSynopsis(id, synopsisData)
        // 저장 후에도 편집 모드 유지
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


  // 새 항목이 아니고 데이터가 없을 때만 로딩 표시
  if (!isNew && isLoading && !currentSynopsis) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error && !isNew) {
    return (
      <div className="p-8">
        <div className="max-w-5xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => navigate(`/works/${workId}`)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            작품으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(`/works/${workId}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            작품으로
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/works/${workId}`)}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Structure Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              기/승/전/결 구조
            </label>
            <SynopsisStructureEditor structure={structure} onChange={setStructure} />
          </div>
        </div>
      </div>
    </div>
  )
}
