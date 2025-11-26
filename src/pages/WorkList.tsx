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
      <div className="p-8 flex justify-center items-center bg-white dark:bg-gray-900">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-6 md:p-8 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-1">작품 목록</h1>
          </div>
          <button
            onClick={() => navigate('/works/new')}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" />
            새 작품
          </button>
        </div>

        {/* Error Message */}
        {(error || loadError) && (
          <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300">
            {error || loadError}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="작품 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchModalOpen(true)}
              className="w-full pl-9 pr-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-gray-900 dark:focus:border-gray-300 transition-colors cursor-pointer bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
          {selectedTagIds.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {selectedTagIds.map((tagId) => {
                const tag = tags.find((t) => t.id === tagId)
                return tag ? (
                  <span
                    key={tagId}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs"
                  >
                    {tag.name}
                    <button
                      onClick={() => setSelectedTagIds(selectedTagIds.filter((id) => id !== tagId))}
                      className="hover:text-gray-900 dark:hover:text-gray-100"
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
          <div className="text-center py-16">
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery ? '검색 결과가 없습니다.' : '작품이 없습니다.'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => navigate('/works/new')}
                className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
              >
                첫 작품 만들기
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWorks.map((work) => {
              const workTags = tags.filter((tag) => work.tags?.includes(tag.id))
              return (
                <Link
                  key={work.id}
                  to={`/works/${work.id}`}
                  className="block p-3 sm:p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all"
                >
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    {/* 제목 및 설명 영역 */}
                    <div className="flex-1">
                      <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">{work.title}</h2>
                      {work.category && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{work.category}</p>
                      )}
                      {work.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{work.description}</p>
                      )}
                      {/* 태그 표시 */}
                      {workTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {workTags.map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-block px-1.5 py-0.5 text-xs text-gray-500 dark:text-gray-400"
                            >
                              #{tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 dark:text-gray-500">
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

