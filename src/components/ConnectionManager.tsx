import { useEffect, useState } from 'react'
import { Link, X } from 'lucide-react'
import { useSynopsisStore } from '@/stores/synopsisStore'
import { useCharacterStore } from '@/stores/characterStore'
import { useSettingStore } from '@/stores/settingStore'

interface ConnectionManagerProps {
  type: 'character' | 'setting'
  connectedIds: string[]
  onUpdate: (ids: string[]) => void
  synopsisId?: string // 특정 시놉시스에 연결된 것만 보여줄 때
  workId?: string // 작품 ID로 필터링
}

export default function ConnectionManager({
  type,
  connectedIds,
  onUpdate,
  synopsisId,
  workId,
}: ConnectionManagerProps) {
  const { synopses, loadSynopses } = useSynopsisStore()
  const { characters, loadCharacters } = useCharacterStore()
  const { settings, loadSettings } = useSettingStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSynopses()
    if (type === 'character') {
      loadCharacters()
    } else {
      loadSettings()
    }
  }, [type, loadSynopses, loadCharacters, loadSettings])

  // 필터링된 목록
  const allItems = type === 'character' ? characters : settings
  const filteredItems = allItems.filter((item) => {
    // 작품 ID로 필터링
    if (workId && item.workId !== workId) {
      return false
    }
    
    const matchesSearch = searchQuery.trim() === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    
    // 특정 시놉시스에 연결된 것만 보여줄 때
    if (synopsisId) {
      return matchesSearch && item.synopsisIds.includes(synopsisId)
    }
    
    return matchesSearch
  })

  const handleToggle = (itemId: string) => {
    if (connectedIds.includes(itemId)) {
      onUpdate(connectedIds.filter((id) => id !== itemId))
    } else {
      onUpdate([...connectedIds, itemId])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          연결된 {type === 'character' ? '캐릭터' : '설정'}
        </label>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {isOpen ? '닫기' : '관리'}
        </button>
      </div>

      {/* 연결된 항목 표시 */}
      {connectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {connectedIds.map((id) => {
            const item = allItems.find((i) => i.id === id)
            if (!item) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                {item.name}
                <button
                  onClick={() => handleToggle(id)}
                  className="hover:text-blue-900"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* 연결 관리 패널 */}
      {isOpen && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <input
            type="text"
            placeholder={`${type === 'character' ? '캐릭터' : '설정'} 검색...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                {type === 'character' ? '캐릭터' : '설정'}가 없습니다.
              </p>
            ) : (
              filteredItems.map((item) => {
                const isConnected = connectedIds.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isConnected}
                      onChange={() => handleToggle(item.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="flex-1 text-sm">{item.name}</span>
                    {item.synopsisIds.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {item.synopsisIds.length}개 연결
                      </span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

