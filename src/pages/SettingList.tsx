import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Loader2, Filter } from 'lucide-react'
import { useSettingStore } from '@/stores/settingStore'
import { useSynopsisStore } from '@/stores/synopsisStore'
import SettingCard from '@/components/SettingCard'
import type { SettingType } from '@/types'

export default function SettingList() {
  const navigate = useNavigate()
  const {
    settings,
    isLoading,
    searchQuery,
    selectedType,
    loadSettings,
    searchSettings,
    setSearchQuery,
    setSelectedType,
  } = useSettingStore()
  const { synopses, loadSynopses } = useSynopsisStore()
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [selectedSynopsisId, setSelectedSynopsisId] = useState<string>('')

  useEffect(() => {
    loadSettings()
    loadSynopses()
  }, [loadSettings, loadSynopses])

  const handleSearch = (query: string) => {
    setLocalSearchQuery(query)
    if (query.trim()) {
      searchSettings(query)
    } else {
      loadSettings()
    }
  }

  const handleCreateNew = () => {
    // SettingList는 더 이상 사용되지 않으므로 작품 목록으로 이동
    navigate('/works')
  }

  const handleTypeFilter = (type: SettingType | '') => {
    setSelectedType(type)
  }

  // 필터링된 설정
  let filteredSettings = selectedType
    ? settings.filter((s) => s.type === selectedType)
    : settings

  // 시놉시스 필터 적용
  if (selectedSynopsisId) {
    filteredSettings = filteredSettings.filter((s) =>
      s.synopsisIds.includes(selectedSynopsisId)
    )
  }

  const settingTypes: Array<{ value: SettingType | ''; label: string }> = [
    { value: '', label: '전체' },
    { value: 'world', label: '세계관' },
    { value: 'location', label: '장소' },
    { value: 'time', label: '시간' },
    { value: 'other', label: '기타' },
  ]

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">설정 관리</h2>
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            새 설정
          </button>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="설정 검색..."
              value={localSearchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filters */}
          <div className="space-y-3">
            {/* Type Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-500" />
              {settingTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => handleTypeFilter(type.value as SettingType | '')}
                  className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                    selectedType === type.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {type.label}
                </button>
              ))}
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
                    {/* @ts-ignore - Old code */}
                    {(synopsis as any).title || '시놉시스'}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredSettings.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-lg mb-2">
              {localSearchQuery || selectedType ? '검색 결과가 없습니다.' : '아직 설정이 없습니다.'}
            </p>
            <p className="text-sm text-gray-400">
              {localSearchQuery || selectedType
                ? '다른 검색어나 필터를 시도해보세요.'
                : '새 설정을 만들어보세요!'}
            </p>
          </div>
        )}

        {/* Settings Grid */}
        {!isLoading && filteredSettings.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSettings.map((setting) => (
              <SettingCard key={setting.id} setting={setting} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

