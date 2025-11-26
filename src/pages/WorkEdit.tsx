import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { Save, ArrowLeft, Loader2, X, Plus } from 'lucide-react'
import { useWorkStore } from '@/stores/workStore'
import { useSynopsisStore } from '@/stores/synopsisStore'
import { useTagStore } from '@/stores/tagStore'
import { syncToNotionInBackground } from '@/utils/notionSync'
import type { WorkInput } from '@/types'

export default function WorkEdit() {
  const { workId } = useParams<{ workId?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  // /works/new 경로인지 확인
  const isNew = location.pathname === '/works/new' || workId === 'new'
  const { currentWork, isLoading, loadWork, createWork, updateWork } = useWorkStore()
  const { createSynopsis } = useSynopsisStore()
  const { tags, categories, loadTags, loadCategories, createTag } = useTagStore()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({}) // 카테고리별 새 태그 입력

  useEffect(() => {
    loadTags()
    loadCategories()
    if (isNew) {
      // 새 작품일 때는 로딩 상태 강제로 false로 설정
      useWorkStore.setState({ isLoading: false, currentWork: null, error: null })
      setTitle('')
      setDescription('')
      setCategory('')
      setSelectedTagIds([])
    } else if (workId) {
      loadWork(workId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workId, isNew, location.pathname])

  useEffect(() => {
    if (currentWork && !isNew) {
      setTitle(currentWork.title)
      setDescription(currentWork.description)
      setCategory(currentWork.category || '')
      setSelectedTagIds(currentWork.tags || [])
    }
  }, [currentWork, isNew])

  const handleSave = async () => {
    console.log('handleSave 호출됨', { isNew, title, workId })
    
    if (!title.trim()) {
      alert('제목을 입력해주세요.')
      return
    }

    console.log('저장 시작, isSaving 설정')
    setIsSaving(true)
    
    try {
      const workData: WorkInput = {
        title: title.trim(),
        description: description.trim(),
        category: category.trim(),
        tags: selectedTagIds,
      }

      console.log('workData 생성 완료:', workData)
      console.log('isNew 확인:', isNew)

      if (isNew) {
        console.log('작품 생성 시작:', workData)
        try {
          const newWork = await createWork(workData)
          console.log('작품 생성 완료:', newWork)
          if (newWork && newWork.id) {
            // 작품 생성 시 빈 시놉시스 자동 생성
            try {
              await createSynopsis({
                workId: newWork.id,
                structure: {
                  gi: [],
                  seung: [],
                  jeon: [],
                  gyeol: [],
                },
                characterIds: [],
                settingIds: [],
              })
              console.log('시놉시스 자동 생성 완료')
            } catch (synopsisError) {
              console.error('시놉시스 자동 생성 실패:', synopsisError)
              // 시놉시스 생성 실패해도 작품은 생성되었으므로 계속 진행
            }
            console.log('작품 상세 페이지로 이동:', `/works/${newWork.id}`)
            navigate(`/works/${newWork.id}`)
          } else {
            throw new Error('작품 생성 후 ID를 받지 못했습니다.')
          }
        } catch (createError) {
          console.error('createWork 에러:', createError)
          throw createError
        }
      } else if (workId) {
        console.log('작품 업데이트 시작:', workId)
        await updateWork(workId, workData)
        navigate(`/works/${workId}`)
      } else {
        console.error('작품 ID가 없습니다:', { isNew, workId })
        throw new Error('작품 ID가 없습니다.')
      }
      
      // 노션 동기화 (백그라운드)
      syncToNotionInBackground().catch(console.error)
    } catch (error) {
      console.error('저장 실패:', error)
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'
      alert(`저장에 실패했습니다: ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }

  // 새 작품일 때는 isLoading과 관계없이 무조건 폼 표시
  // 기존 작품 편집일 때만 로딩 표시
  if (!isNew && isLoading && !currentWork) {
    return (
      <div className="p-8 flex justify-center items-center bg-white dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 md:mb-8">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {isNew ? '새 작품 만들기' : '작품 편집'}
          </h1>
        </div>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작품 제목을 입력하세요"
              className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="작품에 대한 간단한 설명을 입력하세요"
              rows={6}
              className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors resize-none bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              카테고리
            </label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="카테고리를 입력하세요 (예: 판타지, 현대물 등)"
              className="w-full px-3 py-2 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              태그
            </label>
            {/* 선택된 태그를 대분류별로 표시 */}
            <div className="space-y-3 mb-4">
              {categories.map((category) => {
                const selectedCategoryTags = tags.filter(
                  (tag) => tag.categoryId === category.id && selectedTagIds.includes(tag.id)
                )
                if (selectedCategoryTags.length === 0) return null

                return (
                  <div key={category.id}>
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{category.name}</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCategoryTags.map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          {tag.name}
                          <button
                            type="button"
                            onClick={() => setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id))}
                            className="hover:text-gray-900 dark:hover:text-gray-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="space-y-4">
              {categories.map((category) => {
                const categoryTags = tags.filter((t) => t.categoryId === category.id)
                const newTagInput = newTagInputs[category.id] || ''

                const handleAddNewTag = async () => {
                  if (!newTagInput.trim()) return

                  const categoryTags = tags.filter((t) => t.categoryId === category.id)
                  const maxOrder = categoryTags.length > 0 ? Math.max(...categoryTags.map((t) => t.order)) : -1

                  try {
                    const newTag = await createTag({
                      categoryId: category.id,
                      name: newTagInput.trim(),
                      order: maxOrder + 1,
                      isNew: true,
                    })
                    // 새 태그를 즉시 선택
                    setSelectedTagIds([...selectedTagIds, newTag.id])
                    // 입력 필드 초기화
                    setNewTagInputs((prev) => ({ ...prev, [category.id]: '' }))
                    // 태그 목록 새로고침
                    await loadTags()
                  } catch (error) {
                    console.error('태그 추가 실패:', error)
                    alert('태그 추가에 실패했습니다.')
                  }
                }

                return (
                  <div key={category.id}>
                    <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{category.name}</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {categoryTags.map((tag) => {
                        const isSelected = selectedTagIds.includes(tag.id)
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id))
                              } else {
                                setSelectedTagIds([...selectedTagIds, tag.id])
                              }
                            }}
                            className={`px-2 py-0.5 rounded text-xs transition-colors ${
                              isSelected
                                ? 'bg-gray-900 dark:bg-gray-500 text-white dark:text-white border border-gray-700 dark:border-gray-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent'
                            }`}
                          >
                            {tag.name}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newTagInput}
                        onChange={(e) =>
                          setNewTagInputs((prev) => ({ ...prev, [category.id]: e.target.value }))
                        }
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            handleAddNewTag()
                          }
                        }}
                        placeholder="새 태그 추가..."
                        className="flex-1 px-3 py-1.5 text-base border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddNewTag}
                        disabled={!newTagInput.trim()}
                        className="px-2.5 py-1 text-xs bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        추가
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => navigate(isNew ? '/works' : `/works/${workId}`)}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              취소
            </button>
            <button
              onClick={(e) => {
                e.preventDefault()
                console.log('저장 버튼 클릭됨, title:', title)
                handleSave()
              }}
              disabled={isSaving || !title.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </div>
  )
}

