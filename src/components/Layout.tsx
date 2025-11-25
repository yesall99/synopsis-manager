import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { BookOpen, Users, Settings as SettingsIcon, Cloud, CloudOff, Loader2, AlertCircle, Tags } from 'lucide-react'
import { useSyncStore } from '@/stores/syncStore'
import { isFirebaseConfigured } from '@/config/firebase'
import SettingsModal from '@/components/SettingsModal'

export default function Layout() {
  const location = useLocation()
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const {
    user,
    isAuthenticated,
    isSyncing,
    lastSyncedAt,
    syncProgress,
    syncError,
    initialize,
    signIn,
    signOut,
    sync,
    clearSyncError,
  } = useSyncStore()

  const firebaseConfigured = isFirebaseConfigured()

  useEffect(() => {
    if (firebaseConfigured) {
      initialize()
    }
  }, [initialize, firebaseConfigured])

  const navItems = [
    { path: '/works', label: '작품 목록', icon: BookOpen },
    { path: '/tags', label: '태그 관리', icon: Tags },
  ]

  const handleSync = async () => {
    if (!isAuthenticated) {
      try {
        await signIn()
      } catch (error) {
        // 로그인 실패는 이미 syncError에 저장됨
        return
      }
    }

    try {
      await sync()
    } catch (error) {
      // 동기화 실패는 이미 syncError에 저장됨
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return ''
    return new Date(date).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <h1 className="text-xl font-bold text-gray-900">시놉시스 매니저</h1>
          <p className="text-sm text-gray-500 mt-1">작품 관리 프로그램</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || (item.path === '/works' && location.pathname.startsWith('/works'))
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
            <li>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-700 hover:bg-gray-50"
              >
                <SettingsIcon className="w-5 h-5" />
                <span>설정</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Sync Status */}
        {firebaseConfigured && (
          <div className="p-4 border-t border-gray-200 space-y-3 flex-shrink-0">
            {!isAuthenticated ? (
              <button
                onClick={handleSync}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Cloud className="w-4 h-4" />
                <span>로그인 및 동기화</span>
              </button>
            ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="flex-1 truncate">{user?.email || '사용자'}</span>
                <button
                  onClick={signOut}
                  className="text-gray-400 hover:text-gray-600"
                  title="로그아웃"
                >
                  ×
                </button>
              </div>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>동기화 중...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-4 h-4" />
                    <span>동기화</span>
                  </>
                )}
              </button>
              {isSyncing && syncProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress}%` }}
                  ></div>
                </div>
              )}
              {lastSyncedAt && !isSyncing && (
                <p className="text-xs text-gray-500 text-center">
                  <Cloud className="w-3 h-3 inline mr-1" />
                  {formatDate(lastSyncedAt)} 동기화됨
                </p>
              )}
            </>
          )}

          {syncError && (
            <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p>{syncError}</p>
                <button
                  onClick={clearSyncError}
                  className="mt-1 text-red-600 hover:text-red-800 underline"
                >
                  닫기
                </button>
              </div>
            </div>
          )}
          </div>
        )}
        {!firebaseConfigured && (
          <div className="p-4 border-t border-gray-200 flex-shrink-0">
            <p className="text-xs text-gray-500 text-center">
              <CloudOff className="w-3 h-3 inline mr-1" />
              클라우드 동기화를 사용하려면 Firebase 설정이 필요합니다
            </p>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="ml-64">
        <Outlet />
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </div>
  )
}

