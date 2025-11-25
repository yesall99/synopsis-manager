import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Loader2 } from 'lucide-react'
import { useSynopsisStore } from '@/stores/synopsisStore'
import SynopsisCard from '@/components/SynopsisCard'

export default function SynopsisList() {
  const navigate = useNavigate()
  const { 
    synopses, 
    isLoading, 
    searchQuery, 
    loadSynopses, 
    searchSynopses, 
    setSearchQuery 
  } = useSynopsisStore()
  const [localSearchQuery, setLocalSearchQuery] = useState('')

  useEffect(() => {
    loadSynopses()
  }, [loadSynopses])

  const handleSearch = (query: string) => {
    setLocalSearchQuery(query)
    if (query.trim()) {
      searchSynopses(query)
    } else {
      loadSynopses()
    }
  }

  const handleCreateNew = () => {
    navigate('/synopsis/new')
  }

  // 필터링된 시놉시스
  const filteredSynopses = synopses

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">시놉시스 목록</h2>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 시놉시스
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="시놉시스 검색..."
              value={localSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredSynopses.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">
              {localSearchQuery ? '검색 결과가 없습니다.' : '아직 시놉시스가 없습니다.'}
            </p>
            <p className="text-sm text-gray-400">
              {localSearchQuery ? '다른 검색어를 시도해보세요.' : '새 시놉시스를 만들어보세요!'}
            </p>
          </div>
        )}

        {/* Synopsis Grid */}
        {!isLoading && filteredSynopses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSynopses.map((synopsis) => (
              <SynopsisCard key={synopsis.id} synopsis={synopsis} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

