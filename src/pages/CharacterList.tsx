import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Loader2, Filter } from 'lucide-react'
import { useCharacterStore } from '@/stores/characterStore'
import { useSynopsisStore } from '@/stores/synopsisStore'
import CharacterCard from '@/components/CharacterCard'

export default function CharacterList() {
  const navigate = useNavigate()
  const {
    characters,
    isLoading,
    searchQuery,
    loadCharacters,
    searchCharacters,
    setSearchQuery,
  } = useCharacterStore()
  const { synopses, loadSynopses } = useSynopsisStore()
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [selectedSynopsisId, setSelectedSynopsisId] = useState<string>('')

  useEffect(() => {
    loadCharacters()
    loadSynopses()
  }, [loadCharacters, loadSynopses])

  const handleSearch = (query: string) => {
    setLocalSearchQuery(query)
    if (query.trim()) {
      searchCharacters(query)
    } else {
      loadCharacters()
    }
  }

  const handleCreateNew = () => {
    // CharacterList는 더 이상 사용되지 않으므로 작품 목록으로 이동
    navigate('/works')
  }

  // 필터링된 캐릭터
  const filteredCharacters = selectedSynopsisId
    ? characters.filter((c) => c.synopsisIds.includes(selectedSynopsisId))
    : characters

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">캐릭터 관리</h2>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 캐릭터
          </button>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="캐릭터 검색..."
              value={localSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Synopsis Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedSynopsisId}
              onChange={(e) => setSelectedSynopsisId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체 시놉시스</option>
              {synopses.map((synopsis) => (
                <option key={synopsis.id} value={synopsis.id}>
                  {synopsis.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredCharacters.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">
              {localSearchQuery ? '검색 결과가 없습니다.' : '아직 캐릭터가 없습니다.'}
            </p>
            <p className="text-sm text-gray-400">
              {localSearchQuery ? '다른 검색어를 시도해보세요.' : '새 캐릭터를 만들어보세요!'}
            </p>
          </div>
        )}

        {/* Character Grid */}
        {!isLoading && filteredCharacters.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCharacters.map((character) => (
              <CharacterCard key={character.id} character={character} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

