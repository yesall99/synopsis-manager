import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useThemeStore } from './stores/themeStore'

// 테마 초기화 - persist가 복원된 후에 실행
useThemeStore.persist.onFinishHydration((state) => {
  if (state) {
    const root = document.documentElement
    // 기존 dark 클래스 제거
    root.classList.remove('dark')
    // 테마에 따라 dark 클래스 추가
    if (state.theme === 'dark') {
      root.classList.add('dark')
    }
    console.log('[main.tsx] Theme hydrated:', state.theme, 'Has dark class:', root.classList.contains('dark'))
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

