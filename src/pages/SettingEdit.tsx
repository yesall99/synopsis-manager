import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, Loader2, Edit2, X } from 'lucide-react'
import { useSettingStore } from '@/stores/settingStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import SynopsisEditor from '@/components/SynopsisEditor'
import type { SettingType } from '@/types'

export default function SettingEdit() {
  const { workId, id } = useParams<{ workId: string; id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const {
    currentSetting,
    isLoading,
    error,
    loadSetting,
    createSetting,
    updateSetting,
    deleteSetting,
    clearCurrentSetting,
    settings,
  } = useSettingStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<SettingType>('other')
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    type: 'other' as SettingType,
    notes: '',
  })

  const settingTypes: Array<{ value: SettingType; label: string }> = [
    { value: 'world', label: '세계관' },
    { value: 'location', label: '장소' },
    { value: 'time', label: '시간' },
    { value: 'other', label: '기타' },
  ]

  useEffect(() => {
    if (isNew) {
      if (!workId) {
        navigate('/works')
        return
      }
      clearCurrentSetting()
      setName('')
      setDescription('')
      setType('other')
      setNotes('')
      setIsEditing(true) // 새 항목은 바로 편집 모드
    } else if (id) {
      loadSetting(id)
      setIsEditing(false) // 기존 항목은 보기 모드로 시작
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, workId, isNew, navigate])

  useEffect(() => {
    if (currentSetting && !isNew) {
      setName(currentSetting.name)
      setDescription(currentSetting.description)
      setType(currentSetting.type)
      setNotes(currentSetting.notes)
    }
  }, [currentSetting, isNew])
  
  const startEdit = () => {
    setEditData({ name, description, type, notes })
    setIsEditing(true)
  }
  
  const cancelEdit = () => {
    if (isNew) return
    setName(editData.name)
    setDescription(editData.description)
    setType(editData.type)
    setNotes(editData.notes)
    setIsEditing(false)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setIsSaving(true)
    try {
      if (isNew) {
        if (!workId) {
          alert('작품 ID가 없습니다.')
          return
        }
        // 같은 workId의 설정 중 최대 order 찾기
        const sameWorkSettings = settings.filter((s) => s.workId === workId)
        const maxOrder = sameWorkSettings.length > 0
          ? Math.max(...sameWorkSettings.map((s) => s.order ?? 0))
          : -1

        await createSetting({
          workId,
          name: name.trim(),
          description: description.trim(),
          type,
          order: maxOrder + 1,
          notes: notes.trim(),
          synopsisIds: [],
        })
        navigate(`/works/${workId}`, { state: { tab: 'settings' } })
      } else if (id) {
        await updateSetting(id, {
          name: name.trim(),
          description: description.trim(),
          type,
          notes: notes.trim(),
          synopsisIds: [],
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

    if (confirm('정말 이 설정을 삭제하시겠습니까?')) {
      try {
        await deleteSetting(id)
        navigate(`/works/${workId}`, { state: { tab: 'settings' } })
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  if (isLoading && !isNew) {
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
            onClick={() => navigate(`/works/${workId}`, { state: { tab: 'settings' } })}
            className="mt-4 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800"
          >
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-end mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {!isNew && !isEditing && (
              <>
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
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  저장
                </button>
              </>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className={`block ${isEditing ? 'text-xs text-gray-500 dark:text-gray-400 mb-3' : 'text-xs text-gray-500 dark:text-gray-400 mb-3'}`}>
              이름 *
            </label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="설정 이름을 입력하세요"
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            ) : (
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{name || '(이름 없음)'}</h2>
            )}
          </div>

          {/* Type */}
          <div>
            <label className={`block ${isEditing ? 'text-xs text-gray-500 dark:text-gray-400 mb-3' : 'text-xs text-gray-500 dark:text-gray-400 mb-3'}`}>
              유형 *
            </label>
            {isEditing ? (
              <select
                value={type}
                onChange={(e) => setType(e.target.value as SettingType)}
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100"
              >
                {settingTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-base text-gray-900 dark:text-gray-100">
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                  {settingTypes.find((t) => t.value === type)?.label || type}
                </span>
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={`block ${isEditing ? 'text-xs text-gray-500 dark:text-gray-400 mb-3' : 'text-xs text-gray-500 dark:text-gray-400 mb-3'}`}>
              설명
            </label>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="설정에 대한 간단한 설명을 입력하세요"
                rows={4}
                className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
              />
            ) : (
              <p className="text-base text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{description || '(설명 없음)'}</p>
            )}
          </div>


          {/* Notes */}
          <div>
            <label className={`block ${isEditing ? 'text-xs text-gray-500 dark:text-gray-400 mb-3' : 'text-xs text-gray-500 dark:text-gray-400 mb-3'}`}>
              노트
            </label>
            {isEditing ? (
              <SynopsisEditor content={notes} onChange={setNotes} placeholder="설정에 대한 상세한 노트를 작성하세요..." />
            ) : (
              <div
                className="prose prose-sm max-w-none bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4"
                dangerouslySetInnerHTML={{ __html: notes || '<p class="text-sm text-gray-400 dark:text-gray-500 text-center">(노트 없음)</p>' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
