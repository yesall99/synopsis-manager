import { useEffect, useState } from 'react'
import { Link, X } from 'lucide-react'
import { useSynopsisStore } from '@/stores/synopsisStore'

interface SynopsisConnectionManagerProps {
  connectedIds: string[]
  onUpdate: (ids: string[]) => void
}

interface SynopsisConnectionManagerProps {
  connectedIds: string[]
  onUpdate: (ids: string[]) => void
  workId?: string // 작품 ID로 필터링
}

export default function SynopsisConnectionManager({
  connectedIds,
  onUpdate,
  workId,
}: SynopsisConnectionManagerProps) {
  const { synopses, loadSynopses } = useSynopsisStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadSynopses()
  }, [loadSynopses])

  // 필터링된 시놉시스 목록
  const filteredSynopses = synopses.filter((synopsis) => {
    // 작품 ID로 필터링
    if (workId && synopsis.workId !== workId) {
      return false
    }
    const matchesSearch = searchQuery.trim() === '' || 
      (synopsis.structure && JSON.stringify(synopsis.structure).toLowerCase().includes(searchQuery.toLowerCase()))
    return matchesSearch
  })

  const handleToggle = (synopsisId: string) => {
    if (connectedIds.includes(synopsisId)) {
      onUpdate(connectedIds.filter((id) => id !== synopsisId))
    } else {
      onUpdate([...connectedIds, synopsisId])
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          연결된 시놉시스
        </label>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          {isOpen ? '닫기' : '관리'}
        </button>
      </div>

      {/* 연결된 시놉시스 표시 */}
      {connectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {connectedIds.map((id) => {
            const synopsis = synopses.find((s) => s.id === id)
            if (!synopsis) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
              >
                시놉시스
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
            placeholder="시놉시스 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-60 overflow-y-auto space-y-2">
            {filteredSynopses.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                시놉시스가 없습니다.
              </p>
            ) : (
              filteredSynopses.map((synopsis) => {
                const isConnected = connectedIds.includes(synopsis.id)
                return (
                  <label
                    key={synopsis.id}
                    className="flex items-center gap-3 p-2 hover:bg-white rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isConnected}
                      onChange={() => handleToggle(synopsis.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium">시놉시스</span>
                    </div>
                    {synopsis.characterIds.length > 0 || synopsis.settingIds.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {synopsis.characterIds.length + synopsis.settingIds.length}개 연결
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

