import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Plus, Loader2, BookOpen } from 'lucide-react'
import { useWorkStore } from '@/stores/workStore'
import { useSynopsisStore } from '@/stores/synopsisStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingStore } from '@/stores/settingStore'
import { useTagStore } from '@/stores/tagStore'
import SearchModal from '@/components/SearchModal'

export default function WorkList() {
  const navigate = useNavigate()
  const { works, isLoading, loadWorks, error } = useWorkStore()
  const { synopses, loadSynopses } = useSynopsisStore()
  const { characters, loadCharacters } = useCharacterStore()
  const { settings, loadSettings } = useSettingStore()
  const { tags, loadTags } = useTagStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoadError(null)
      try {
        // 순차적으로 로드하여 에러 발생 시 정확히 파악
        await loadWorks()
        await loadSynopses()
        await loadCharacters()
        await loadSettings()
        await loadTags()
      } catch (error) {
        console.error('데이터 로드 실패:', error)
        setLoadError(error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.')
        // 에러가 발생해도 로딩 상태를 해제
        useWorkStore.setState({ isLoading: false })
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredWorks = works.filter((work) => {
    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        work.title.toLowerCase().includes(query) ||
        work.description.toLowerCase().includes(query) ||
        work.category.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    // 태그 필터
    if (selectedTagIds.length > 0) {
      const workTagIds = work.tags || []
      const hasAllSelectedTags = selectedTagIds.every((tagId) => workTagIds.includes(tagId))
      if (!hasAllSelectedTags) return false
    }

    return true
  })

  const handleSearch = (query: string, tagIds: string[]) => {
    setSearchQuery(query)
    setSelectedTagIds(tagIds)
  }


  if (isLoading && works.length === 0) {
    return (
      <div className="p-8 flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">작품 목록</h1>
            <p className="text-gray-500 mt-1">작품을 선택하여 관리하세요</p>
          </div>
          <button
            onClick={() => navigate('/works/new')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            새 작품
          </button>
        </div>

        {/* Error Message */}
        {(error || loadError) && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">
              {error || loadError}
            </p>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="작품 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchModalOpen(true)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          {selectedTagIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedTagIds.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId)
                return tag ? (
                  <span
                    key={tagId}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm"
                  >
                    {tag.name}
                    <button
                      onClick={() => setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId))}
                      className="hover:text-purple-900"
                    >
                      ×
                    </button>
                  </span>
                ) : null
              })}
            </div>
          )}
        </div>

        {/* Search Modal */}
        <SearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          selectedTags={selectedTagIds}
          onTagsChange={setSelectedTagIds}
          onSearch={handleSearch}
        />

        {/* Works Grid */}
        {filteredWorks.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">
              {searchQuery ? '검색 결과가 없습니다.' : '작품이 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/works/new')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                첫 작품 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWorks.map((work) => {
              const workTags = tags.filter((tag) => work.tags?.includes(tag.id))
              return (
                <Link
                  key={work.id}
                  to={`/works/${work.id}`}
                  className="block bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex gap-4">
                    {/* 제목 및 설명 영역 */}
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">{work.title}</h2>
                      {work.category && (
                        <p className="text-sm text-gray-500 mb-2">{work.category}</p>
                      )}
                      {work.description && (
                        <p className="text-gray-600 text-sm mb-3 line-clamp-3">{work.description}</p>
                      )}
                      {/* 태그 표시 */}
                      {workTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {workTags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-400">
                        {new Date(work.updatedAt).toLocaleDateString('ko-KR')}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

