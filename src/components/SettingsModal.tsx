import { useState, useEffect } from 'react'
import { X, Moon, Sun, Cloud, Download, Upload, Trash2, AlertTriangle, Key, Check, Loader2 } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { isFirebaseConfigured } from '@/config/firebase'
import { workService } from '@/services/storage/storageService'
import { synopsisService } from '@/services/storage/storageService'
import { characterService } from '@/services/storage/storageService'
import { settingService } from '@/services/storage/storageService'
import { episodeService } from '@/services/storage/storageService'
import { chapterService } from '@/services/storage/storageService'
import { tagService } from '@/services/storage/storageService'
import { tagCategoryService } from '@/services/storage/tagService'
import { getNotionClient, initializeNotionDatabases, syncToNotion, syncFromNotion, getAccessiblePages, verifyRootPage } from '@/services/sync/notion'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

type SettingsTab = 'general' | 'sync' | 'data'

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' || 
           (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })
  const { user, isAuthenticated, signIn, signOut } = useSyncStore()
  const firebaseConfigured = isFirebaseConfigured()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  // 노션 동기화 상태
  const [notionApiKey, setNotionApiKey] = useState(() => localStorage.getItem('notionApiKey') || '')
  const [notionPageId, setNotionPageId] = useState(() => localStorage.getItem('notionRootPageId') || '')
  const [accessiblePages, setAccessiblePages] = useState<Array<{ id: string; title: string }>>([])
  const [isLoadingPages, setIsLoadingPages] = useState(false)
  const [isNotionConnected, setIsNotionConnected] = useState(() => {
    const key = localStorage.getItem('notionApiKey')
    const pageId = localStorage.getItem('notionRootPageId')
    const dbIds = localStorage.getItem('notionDatabaseIds')
    return !!(key && pageId && dbIds)
  })
  const [isNotionInitializing, setIsNotionInitializing] = useState(false)
  const [isNotionSyncing, setIsNotionSyncing] = useState(false)
  const [notionError, setNotionError] = useState<string | null>(null)

  // 다크모드 토글
  const toggleDarkMode = () => {
    const newMode = !isDarkMode
    setIsDarkMode(newMode)
    localStorage.setItem('theme', newMode ? 'dark' : 'light')
    if (newMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 초기 다크모드 적용
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // 데이터 내보내기
  const handleExport = async () => {
    setIsExporting(true)
    try {
      const works = await workService.getAll()
      const synopses = await synopsisService.getAll()
      const characters = await characterService.getAll()
      const settings = await settingService.getAll()
      const episodes = await episodeService.getAll()
      const chapters = await chapterService.getAll()
      const tags = await tagService.getAll()

      const data = {
        works,
        synopses,
        characters,
        settings,
        episodes,
        chapters,
        tags,
        exportDate: new Date().toISOString(),
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `novel-synopsis-backup-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert('데이터 내보내기가 완료되었습니다.')
    } catch (error) {
      console.error('내보내기 실패:', error)
      alert('데이터 내보내기에 실패했습니다.')
    } finally {
      setIsExporting(false)
    }
  }

  // 데이터 가져오기
  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      setIsImporting(true)
      try {
        const text = await file.text()
        const data = JSON.parse(text)

        if (!confirm('기존 데이터가 모두 삭제되고 가져온 데이터로 대체됩니다. 계속하시겠습니까?')) {
          setIsImporting(false)
          return
        }

        // 모든 데이터 삭제 후 가져오기
        const works = await workService.getAll()
        for (const work of works) {
          await workService.delete(work.id)
        }

        // 가져온 데이터 추가
        if (data.works) {
          for (const work of data.works) {
            await workService.create(work)
          }
        }
        if (data.synopses) {
          for (const synopsis of data.synopses) {
            await synopsisService.create(synopsis)
          }
        }
        if (data.characters) {
          for (const character of data.characters) {
            await characterService.create(character)
          }
        }
        if (data.settings) {
          for (const setting of data.settings) {
            await settingService.create(setting)
          }
        }
        if (data.episodes) {
          for (const episode of data.episodes) {
            await episodeService.create(episode)
          }
        }
        if (data.chapters) {
          for (const chapter of data.chapters) {
            await chapterService.create(chapter)
          }
        }
        if (data.tags) {
          // @ts-ignore - tagService.getAll() doesn't have create method, using tagStore instead
          const { useTagStore } = await import('@/stores/tagStore')
          for (const tag of data.tags) {
            // Use tagStore.create instead
            await useTagStore.getState().createTag(tag)
          }
        }

        alert('데이터 가져오기가 완료되었습니다. 페이지를 새로고침합니다.')
        window.location.reload()
      } catch (error) {
        console.error('가져오기 실패:', error)
        alert('데이터 가져오기에 실패했습니다. 파일 형식이 올바른지 확인해주세요.')
      } finally {
        setIsImporting(false)
      }
    }
    input.click()
  }

  // 데이터 초기화
  const handleDeleteAll = async () => {
    if (!confirm('모든 데이터가 삭제됩니다. 이 작업은 되돌릴 수 없습니다. 정말 삭제하시겠습니까?')) {
      return
    }

    if (!confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return
    }

    try {
      const works = await workService.getAll()
      for (const work of works) {
        await workService.delete(work.id)
      }
      
      alert('모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다.')
      window.location.reload()
    } catch (error) {
      console.error('삭제 실패:', error)
      alert('데이터 삭제에 실패했습니다.')
    }
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'general' as SettingsTab, label: '일반', icon: Sun },
    { id: 'sync' as SettingsTab, label: '동기화', icon: Cloud },
    { id: 'data' as SettingsTab, label: '데이터 관리', icon: Download },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 h-[85vh] flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* 왼쪽 사이드바 */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">설정</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{tab.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>

        {/* 오른쪽 콘텐츠 영역 */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-8">
            {/* 일반 설정 */}
            {activeTab === 'general' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">일반 설정</h3>
                <div className="space-y-6">
                  <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">테마 모드</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        내 기기에서 앱의 모습을 마음껏 바꿔보세요.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={toggleDarkMode}
                        className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        {isDarkMode ? '라이트 모드' : '다크 모드'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 동기화 설정 */}
            {activeTab === 'sync' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">동기화 설정</h3>
                <div className="space-y-8">
                  {/* 구글 동기화 */}
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">구글 동기화</h4>
                    <div className="space-y-4">
                      {firebaseConfigured ? (
                        <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">로그인 상태</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {isAuthenticated 
                                ? `현재 ${user?.email || '사용자'}로 로그인되어 있습니다.`
                                : '구글 계정으로 로그인하여 여러 기기에서 데이터를 동기화할 수 있습니다.'}
                            </p>
                          </div>
                          <div className="ml-4">
                            {isAuthenticated ? (
                              <button
                                onClick={signOut}
                                className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                              >
                                로그아웃
                              </button>
                            ) : (
                              <button
                                onClick={signIn}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                              >
                                로그인
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            구글 동기화를 사용하려면 Firebase 설정이 필요합니다. 환경 변수에 Firebase 설정을 추가해주세요.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 노션 동기화 */}
                  <div>
                    <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">노션 동기화</h4>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">노션 동기화 설정</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                            노션 API 키를 입력하고, 통합을 연결한 페이지를 선택하여 데이터를 동기화할 수 있습니다.
                          </p>
                          
                          {/* 가이드 */}
                          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-200 mb-2">설정 가이드</p>
                            <ol className="text-xs text-blue-800 dark:text-blue-300 list-decimal list-inside space-y-1">
                              <li>
                                <a
                                  href="https://www.notion.so/profile/integrations"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-blue-900 dark:hover:text-blue-200"
                                >
                                  노션 통합 페이지
                                </a>
                                에서 "새 통합" 버튼을 클릭하여 새 통합 생성
                              </li>
                              <li>통합 이름을 입력하고 생성</li>
                              <li>생성된 통합의 "내부 통합 토큰"에서 API 키 복사</li>
                              <li>노션에서 동기화에 사용할 페이지를 생성하거나 기존 페이지 선택</li>
                              <li>선택한 페이지 우측 상단 "..." 메뉴 → "연결" → 생성한 통합 선택 (편집 권한으로 설정)</li>
                              <li>아래에서 API 키를 입력하고 "페이지 목록 가져오기" 버튼 클릭</li>
                              <li>목록에서 동기화에 사용할 페이지를 선택하고 "연결" 버튼 클릭</li>
                            </ol>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">노션 API 키</label>
                              <input
                                type="password"
                                value={notionApiKey}
                                onChange={(e) => setNotionApiKey(e.target.value)}
                                placeholder="secret_..."
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                              />
                            </div>
                            
                            <button
                              onClick={async () => {
                                if (!notionApiKey.trim()) {
                                  alert('노션 API 키를 입력해주세요.')
                                  return
                                }
                                localStorage.setItem('notionApiKey', notionApiKey.trim())
                                setIsLoadingPages(true)
                                setNotionError(null)
                                try {
                                  const client = getNotionClient()
                                  if (!client) {
                                    throw new Error('노션 클라이언트를 생성할 수 없습니다.')
                                  }
                                  const pages = await getAccessiblePages(client)
                                  setAccessiblePages(pages)
                                  if (pages.length === 0) {
                                    setNotionError('접근 가능한 페이지가 없습니다. 통합을 페이지에 연결했는지 확인해주세요.')
                                  }
                                } catch (error) {
                                  console.error('노션 페이지 목록 가져오기 실패:', error)
                                  setNotionError(error instanceof Error ? error.message : '페이지 목록을 가져오는데 실패했습니다.')
                                  setAccessiblePages([])
                                } finally {
                                  setIsLoadingPages(false)
                                }
                              }}
                              disabled={isLoadingPages || !notionApiKey.trim()}
                              className="w-full px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isLoadingPages ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  페이지 목록 가져오는 중...
                                </>
                              ) : (
                                <>
                                  <Cloud className="w-4 h-4" />
                                  페이지 목록 가져오기
                                </>
                              )}
                            </button>

                            {accessiblePages.length > 0 && (
                              <div>
                                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">동기화에 사용할 페이지 선택</label>
                                <select
                                  value={notionPageId}
                                  onChange={(e) => setNotionPageId(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                >
                                  <option value="">페이지를 선택하세요</option>
                                  {accessiblePages.map((page) => (
                                    <option key={page.id} value={page.id}>
                                      {page.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}

                            <button
                              onClick={async () => {
                                if (!notionApiKey.trim()) {
                                  alert('노션 API 키를 입력해주세요.')
                                  return
                                }
                                if (!notionPageId.trim()) {
                                  alert('동기화에 사용할 페이지를 선택해주세요.')
                                  return
                                }
                                localStorage.setItem('notionApiKey', notionApiKey.trim())
                                localStorage.setItem('notionRootPageId', notionPageId.trim())
                                setIsNotionInitializing(true)
                                setNotionError(null)
                                try {
                                  const client = getNotionClient()
                                  if (!client) {
                                    throw new Error('노션 클라이언트를 생성할 수 없습니다.')
                                  }
                                  // 페이지 접근 권한만 확인 (데이터베이스 생성은 업로드 시 자동으로 처리)
                                  const hasAccess = await verifyRootPage(client, notionPageId.trim())
                                  if (!hasAccess) {
                                    throw new Error('노션 페이지에 접근할 수 없습니다. 통합이 해당 페이지에 연결되어 있는지 확인해주세요.')
                                  }
                                  setIsNotionConnected(true)
                                  alert('노션 동기화가 설정되었습니다.')
                                } catch (error) {
                                  console.error('노션 연결 실패:', error)
                                  setNotionError(error instanceof Error ? error.message : '노션 연결에 실패했습니다.')
                                  setIsNotionConnected(false)
                                } finally {
                                  setIsNotionInitializing(false)
                                }
                              }}
                              disabled={isNotionInitializing || !notionApiKey.trim() || !notionPageId.trim()}
                              className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                              {isNotionInitializing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  초기화 중...
                                </>
                              ) : (
                                <>
                                  <Key className="w-4 h-4" />
                                  연결
                                </>
                              )}
                            </button>
                          </div>
                          {isNotionConnected && (
                            <div className="mt-2 flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                              <Check className="w-4 h-4" />
                              <span>노션과 연결되었습니다.</span>
                            </div>
                          )}
                          {notionError && (
                            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                              {notionError}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {isNotionConnected && (
                        <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">데이터 동기화</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              로컬 데이터를 노션으로 업로드하거나 노션에서 데이터를 가져옵니다.
                            </p>
                          </div>
                          <div className="ml-4 flex gap-2">
                            <button
                              onClick={async () => {
                                console.log('노션으로 업로드 버튼 클릭됨')
                                setIsNotionSyncing(true)
                                setNotionError(null)
                                try {
                                  console.log('노션 클라이언트 생성 시도...')
                                  const client = getNotionClient()
                                  if (!client) {
                                    throw new Error('노션 클라이언트를 생성할 수 없습니다.')
                                  }
                                  console.log('데이터 로드 시작...')
                                  const works = await workService.getAll()
                                  const synopses = await synopsisService.getAll()
                                  const characters = await characterService.getAll()
                                  const settings = await settingService.getAll()
                                  const episodes = await episodeService.getAll()
                                  const chapters = await chapterService.getAll()
                                  const tags = await tagService.getAll()
                                  const tagCategories = await tagCategoryService.getAll()
                                  
                                  console.log('로드된 데이터:', {
                                    works: works.length,
                                    synopses: synopses.length,
                                    characters: characters.length,
                                    settings: settings.length,
                                    episodes: episodes.length,
                                    chapters: chapters.length,
                                    tags: tags.length,
                                    tagCategories: tagCategories.length,
                                  })
                                  
                                  console.log('syncToNotion 호출 시작...')
                                  await syncToNotion(client, {
                                    works,
                                    synopses,
                                    characters,
                                    settings,
                                    episodes,
                                    chapters,
                                    // @ts-ignore - tags type mismatch
                                    tags: tags as any,
                                    tagCategories,
                                  })
                                  console.log('syncToNotion 완료')
                                  alert('노션으로 데이터 동기화가 완료되었습니다.')
                                } catch (error) {
                                  console.error('노션 동기화 실패:', error)
                                  if (error instanceof Error) {
                                    console.error('에러 상세:', error.message, error.stack)
                                  }
                                  setNotionError(error instanceof Error ? error.message : '노션 동기화에 실패했습니다.')
                                } finally {
                                  setIsNotionSyncing(false)
                                }
                              }}
                              disabled={isNotionSyncing}
                              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isNotionSyncing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  동기화 중...
                                </>
                              ) : (
                                <>
                                  <Cloud className="w-4 h-4" />
                                  노션으로 업로드
                                </>
                              )}
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm('노션에서 데이터를 가져오면 기존 로컬 데이터가 대체됩니다. 계속하시겠습니까?')) {
                                  return
                                }
                                setIsNotionSyncing(true)
                                setNotionError(null)
                                try {
                                  const client = getNotionClient()
                                  if (!client) {
                                    throw new Error('노션 클라이언트를 생성할 수 없습니다.')
                                  }
                                  const data = await syncFromNotion(client)
                                  // TODO: 노션에서 가져온 데이터를 로컬에 저장
                                  alert('노션에서 데이터를 가져왔습니다. (현재는 데이터 가져오기 기능이 구현되지 않았습니다.)')
                                } catch (error) {
                                  console.error('노션에서 가져오기 실패:', error)
                                  setNotionError(error instanceof Error ? error.message : '노션에서 데이터를 가져오는데 실패했습니다.')
                                } finally {
                                  setIsNotionSyncing(false)
                                }
                              }}
                              disabled={isNotionSyncing}
                              className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                              {isNotionSyncing ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  가져오는 중...
                                </>
                              ) : (
                                <>
                                  <Download className="w-4 h-4" />
                                  노션에서 가져오기
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                      
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 데이터 관리 */}
            {activeTab === 'data' && (
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">데이터 관리</h3>
                <div className="space-y-6">
                  <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">데이터 내보내기</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        모든 작품, 시놉시스, 캐릭터, 설정, 회차 데이터를 JSON 파일로 내보냅니다.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {isExporting ? '내보내는 중...' : '내보내기'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start justify-between py-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">데이터 가져오기</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        이전에 내보낸 JSON 파일에서 데이터를 복원합니다. 기존 데이터는 모두 삭제됩니다.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={handleImport}
                        disabled={isImporting}
                        className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        {isImporting ? '가져오는 중...' : '가져오기'}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-start justify-between py-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">모든 데이터 삭제</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        저장된 모든 데이터를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
                      </p>
                    </div>
                    <div className="ml-4">
                      <button
                        onClick={handleDeleteAll}
                        className="px-4 py-2 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        삭제
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

