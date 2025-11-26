import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BookOpen, Users, Settings as SettingsIcon, Tags, ArrowLeft, Menu, X as XIcon } from 'lucide-react'
import SettingsModal from '@/components/SettingsModal'

export default function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 60000) // 1분마다 업데이트

    return () => clearInterval(timer)
  }, [])

  const navItems = [
    { path: '/works', label: '작품 목록', icon: BookOpen },
    { path: '/tags', label: '태그 관리', icon: Tags },
  ]

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  // 뒤로가기 버튼 표시 여부 및 동작 결정
  const getBackButtonInfo = () => {
    const path = location.pathname
    
    // 작품 목록이나 태그 관리 페이지에서는 뒤로가기 버튼 숨김
    if (path === '/works' || path === '/tags' || path === '/') {
      return null
    }

    // 경로 패턴에 따라 뒤로가기 동작 결정
    if (path.startsWith('/works/')) {
      const parts = path.split('/').filter(Boolean)
      
      // /works/new -> /works
      if (parts[1] === 'new') {
        return { label: '작품 목록으로', path: '/works' }
      }
      
      // /works/:workId -> /works
      if (parts.length === 2) {
        return { label: '작품 목록으로', path: '/works' }
      }
      
      // /works/:workId/edit -> /works/:workId
      if (parts[2] === 'edit') {
        return { label: '뒤로', path: `/works/${parts[1]}` }
      }
      
      // /works/:workId/synopsis/:id -> /works/:workId
      if (parts[2] === 'synopsis') {
        return { label: '작품으로', path: `/works/${parts[1]}` }
      }
      
      // /works/:workId/characters/:id -> /works/:workId (characters 탭)
      if (parts[2] === 'characters') {
        return { label: '작품으로', path: `/works/${parts[1]}`, state: { tab: 'characters' } }
      }
      
      // /works/:workId/settings/:id -> /works/:workId (settings 탭)
      if (parts[2] === 'settings') {
        return { label: '작품으로', path: `/works/${parts[1]}`, state: { tab: 'settings' } }
      }
      
      // /works/:workId/chapters -> /works/:workId (episodes 탭)
      if (parts[2] === 'chapters' && parts.length === 3) {
        return { label: '작품으로', path: `/works/${parts[1]}`, state: { tab: 'episodes' } }
      }
      
      // /works/:workId/chapters/:id -> /works/:workId (episodes 탭)
      if (parts[2] === 'chapters' && parts.length === 4) {
        return { label: '작품으로', path: `/works/${parts[1]}`, state: { tab: 'episodes' } }
      }
      
      // /works/:workId/episodes/:id -> /works/:workId (episodes 탭)
      if (parts[2] === 'episodes') {
        return { label: '작품으로', path: `/works/${parts[1]}`, state: { tab: 'episodes' } }
      }
    }
    
    return null
  }

  const handleBack = () => {
    const backInfo = getBackButtonInfo()
    if (backInfo) {
      if (backInfo.state) {
        navigate(backInfo.path, { state: backInfo.state })
      } else {
        navigate(backInfo.path)
      }
    }
  }

  const backButtonInfo = getBackButtonInfo()

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 h-screen w-56 bg-white dark:bg-gray-800 border-r border-gray-100 dark:border-gray-700 flex flex-col overflow-y-auto z-50 transition-transform duration-300 ${
        isMobileMenuOpen 
          ? 'right-0 translate-x-0' 
          : 'right-0 translate-x-full'
      } md:left-0 md:right-auto md:translate-x-0`}>
        <div className="h-12 px-5 border-b border-gray-100 dark:border-gray-700 flex-shrink-0 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">시놉시스 매니저</h1>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-2 overflow-y-auto">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || (item.path === '/works' && location.pathname.startsWith('/works'))
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? 'text-gray-900 dark:text-gray-100 font-medium'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
            <li>
              <button
                onClick={() => {
                  setIsSettingsModalOpen(true)
                  setIsMobileMenuOpen(false)
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
                <span>설정</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Date Time */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p className="text-sm text-gray-600 dark:text-gray-300 text-center font-medium">
            {formatDateTime(currentDateTime)}
          </p>
        </div>
      </aside>

      {/* Top Bar */}
      <header className="fixed top-0 left-0 md:left-56 right-0 h-12 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 z-40 flex items-center justify-between px-3 sm:px-5">
        <div className="flex items-center gap-4">
          {backButtonInfo && (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{backButtonInfo.label}</span>
            </button>
          )}
        </div>
        
        {/* Mobile Menu Button - Right Side */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
        >
          {isMobileMenuOpen ? <XIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Main Content */}
      <main className="md:ml-56 pt-12">
        <Outlet />
      </main>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
    </div>
  )
}

