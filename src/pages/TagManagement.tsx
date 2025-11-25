import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react'
import { useTagStore } from '@/stores/tagStore'
import type { TagCategoryInput, TagInput } from '@/types'

export default function TagManagement() {
  const navigate = useNavigate()
  const {
    categories,
    tags,
    isLoading,
    loadCategories,
    loadTags,
    createCategory,
    updateCategory,
    deleteCategory,
    createTag,
    updateTag,
    deleteTag,
  } = useTagStore()

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagCategoryId, setNewTagCategoryId] = useState<string>('')
  const [isNewCategory, setIsNewCategory] = useState(false)
  const [isNewTag, setIsNewTag] = useState(false)

  useEffect(() => {
    loadCategories()
    loadTags()
  }, [loadCategories, loadTags])

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return

    const maxOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.order)) : -1
    await createCategory({
      name: newCategoryName.trim(),
      order: maxOrder + 1,
    })
    setNewCategoryName('')
    setIsNewCategory(false)
  }

  const handleUpdateCategory = async (id: string, name: string) => {
    if (!name.trim()) return
    await updateCategory(id, { name: name.trim() })
    setEditingCategoryId(null)
  }

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('이 카테고리를 삭제하면 포함된 모든 태그도 삭제됩니다. 계속하시겠습니까?')) {
      return
    }
    await deleteCategory(id)
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !newTagCategoryId) return

    const categoryTags = tags.filter((t) => t.categoryId === newTagCategoryId)
    const maxOrder = categoryTags.length > 0 ? Math.max(...categoryTags.map((t) => t.order)) : -1

    await createTag({
      categoryId: newTagCategoryId,
      name: newTagName.trim(),
      order: maxOrder + 1,
      isNew: false,
    })
    setNewTagName('')
    setNewTagCategoryId('')
    setIsNewTag(false)
  }

  const handleUpdateTag = async (id: string, name: string) => {
    if (!name.trim()) return
    await updateTag(id, { name: name.trim() })
    setEditingTagId(null)
  }

  const handleDeleteTag = async (id: string) => {
    if (!confirm('이 태그를 삭제하시겠습니까?')) return
    await deleteTag(id)
  }

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/works')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            작품 목록으로
          </button>
          <h1 className="text-3xl font-bold text-gray-900">태그 관리</h1>
          <p className="text-gray-500 mt-1">태그를 관리하세요</p>
        </div>

        {/* 새 카테고리 추가 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">태그</h2>
            {!isNewCategory ? (
              <button
                onClick={() => setIsNewCategory(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                새 카테고리 추가
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="카테고리 이름 (예: 장르, 관계)"
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateCategory()
                    }
                  }}
                />
                <button
                  onClick={handleCreateCategory}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Save className="w-4 h-4" />
                  저장
                </button>
                <button
                  onClick={() => {
                    setIsNewCategory(false)
                    setNewCategoryName('')
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 카테고리 목록 */}
          <div className="space-y-4">
            {categories.map((category) => {
              const categoryTags = tags.filter((t) => t.categoryId === category.id)
              const isEditing = editingCategoryId === category.id

              return (
                <div key={category.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={category.name}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget as HTMLInputElement
                            handleUpdateCategory(category.id, input.value)
                          }
                        }}
                        onBlur={(e) => {
                          handleUpdateCategory(category.id, e.target.value)
                        }}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-lg font-semibold">{category.name}</h3>
                    )}
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <>
                          <button
                            onClick={() => setEditingCategoryId(category.id)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* 태그 목록 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">태그</span>
                      {!isNewTag || newTagCategoryId !== category.id ? (
                        <button
                          onClick={() => {
                            setIsNewTag(true)
                            setNewTagCategoryId(category.id)
                          }}
                          className="flex items-center gap-1 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          <Plus className="w-3 h-3" />
                          태그 추가
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            placeholder="태그 이름"
                            className="px-3 py-1 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleCreateTag()
                              }
                            }}
                          />
                          <button
                            onClick={handleCreateTag}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Save className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => {
                              setIsNewTag(false)
                              setNewTagName('')
                              setNewTagCategoryId('')
                            }}
                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {categoryTags.map((tag) => {
                        const isEditingTag = editingTagId === tag.id
                        return (
                          <div
                            key={tag.id}
                            className="flex items-center gap-1 px-3 py-1 bg-gray-100 rounded-full text-sm"
                          >
                            {isEditingTag ? (
                              <input
                                type="text"
                                defaultValue={tag.name}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    const input = e.currentTarget as HTMLInputElement
                                    handleUpdateTag(tag.id, input.value)
                                  }
                                }}
                                onBlur={(e) => {
                                  handleUpdateTag(tag.id, e.target.value)
                                }}
                                className="w-24 px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                autoFocus
                              />
                            ) : (
                              <>
                                <span>{tag.name}</span>
                                <button
                                  onClick={() => setEditingTagId(tag.id)}
                                  className="text-gray-600 hover:text-gray-900"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTag(tag.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

