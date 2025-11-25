import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Save, ArrowLeft, Trash2, Loader2, Edit2, X } from 'lucide-react'
import { useCharacterStore } from '@/stores/characterStore'
import SynopsisEditor from '@/components/SynopsisEditor'

export default function CharacterEdit() {
  const { workId, id } = useParams<{ workId: string; id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const {
    currentCharacter,
    isLoading,
    error,
    loadCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    clearCurrentCharacter,
    characters,
  } = useCharacterStore()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [age, setAge] = useState<number | undefined>(undefined)
  const [role, setRole] = useState('')
  const [isMainCharacter, setIsMainCharacter] = useState(false)
  const [notes, setNotes] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: '',
    description: '',
    age: undefined as number | undefined,
    role: '',
    isMainCharacter: false,
    notes: '',
  })

  useEffect(() => {
    if (isNew) {
      clearCurrentCharacter()
      setName('')
      setDescription('')
      setAge(undefined)
      setRole('')
      setIsMainCharacter(false)
      setNotes('')
      setIsEditing(true) // 새 항목은 바로 편집 모드
    } else if (id) {
      loadCharacter(id)
      setIsEditing(false) // 기존 항목은 보기 모드로 시작
    }
  }, [id, isNew, loadCharacter, clearCurrentCharacter])

  useEffect(() => {
    if (currentCharacter && !isNew) {
      setName(currentCharacter.name)
      setDescription(currentCharacter.description)
      setAge(currentCharacter.age)
      setRole(currentCharacter.role || '')
      setIsMainCharacter(currentCharacter.isMainCharacter || false)
      setNotes(currentCharacter.notes)
    }
  }, [currentCharacter, isNew])
  
  const startEdit = () => {
    setEditData({ name, description, age, role, isMainCharacter, notes })
    setIsEditing(true)
  }
  
  const cancelEdit = () => {
    if (isNew) return
    setName(editData.name)
    setDescription(editData.description)
    setAge(editData.age)
    setRole(editData.role)
    setIsMainCharacter(editData.isMainCharacter)
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
        // 같은 workId의 캐릭터 중 최대 order 찾기
        const sameWorkCharacters = characters.filter((c) => c.workId === workId)
        const maxOrder = sameWorkCharacters.length > 0
          ? Math.max(...sameWorkCharacters.map((c) => c.order ?? 0))
          : -1

        const newCharacter = await createCharacter({
          workId,
          name: name.trim(),
          description: description.trim(),
          age,
          role: role.trim() || undefined,
          isMainCharacter,
          order: maxOrder + 1,
          notes: notes.trim(),
          synopsisIds: [],
        })
        navigate(`/works/${workId}`, { state: { tab: 'characters' } })
      } else if (id) {
        await updateCharacter(id, {
          name: name.trim(),
          description: description.trim(),
          age,
          role: role.trim() || undefined,
          isMainCharacter,
          notes: notes.trim(),
          synopsisIds: [],
        })
        setIsEditing(false) // 저장 후 보기 모드로
      }
    } catch (error) {
      console.error('저장 실패:', error)
      alert('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || isNew) return

    if (confirm('정말 이 캐릭터를 삭제하시겠습니까?')) {
      try {
        await deleteCharacter(id)
        navigate(`/works/${workId}`, { state: { tab: 'characters' } })
      } catch (error) {
        console.error('삭제 실패:', error)
        alert('삭제에 실패했습니다.')
      }
    }
  }

  if (isLoading && !isNew) {
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
            onClick={() => navigate(`/works/${workId}`, { state: { tab: 'characters' } })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            목록으로 돌아가기
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
            onClick={() => navigate(`/works/${workId}`, { state: { tab: 'characters' } })}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </button>
          <div className="flex items-center gap-2">
            {!isNew && !isEditing && (
              <>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  편집
                </button>
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
              </>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              이름 *
            </label>
            {isEditing ? (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="캐릭터 이름을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <h2 className="text-2xl font-bold text-gray-900">{name || '(이름 없음)'}</h2>
            )}
          </div>

          {/* Main Character */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              주연/조연
            </label>
            {isEditing ? (
              <select
                value={isMainCharacter ? 'main' : 'supporting'}
                onChange={(e) => setIsMainCharacter(e.target.value === 'main')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="supporting">조연</option>
                <option value="main">주연</option>
              </select>
            ) : (
              <p className="text-gray-700">{isMainCharacter ? '주연' : '조연'}</p>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역할
            </label>
            {isEditing ? (
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="예: 주인공, 악역, 조력자 등"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-700">{role || '(역할 없음)'}</p>
            )}
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              나이
            </label>
            {isEditing ? (
              <input
                type="number"
                value={age || ''}
                onChange={(e) => setAge(e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="나이를 입력하세요"
                min="0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <p className="text-gray-700">{age ? `${age}세` : '(나이 없음)'}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            {isEditing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="캐릭터에 대한 간단한 설명을 입력하세요"
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{description || '(설명 없음)'}</p>
            )}
          </div>


          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              노트
            </label>
            {isEditing ? (
              <SynopsisEditor content={notes} onChange={setNotes} placeholder="캐릭터에 대한 상세한 노트를 작성하세요..." />
            ) : (
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: notes || '<p class="text-gray-400 italic">(노트 없음)</p>' }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
