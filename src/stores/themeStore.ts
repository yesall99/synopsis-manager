import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  // 무조건 먼저 제거
  root.classList.remove('dark')
  // 다크모드일 때만 추가
  if (theme === 'dark') {
    root.classList.add('dark')
  }
  console.log('[applyTheme] Applied:', theme, 'Has dark:', root.classList.contains('dark'))
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => {
      // 초기 테마 적용
      const saved = localStorage.getItem('theme-storage')
      let initialTheme: Theme = 'light'
      
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.state?.theme === 'dark' || parsed.state?.theme === 'light') {
            initialTheme = parsed.state.theme
          }
        } catch (e) {
          // 파싱 실패 시 기본값 사용
        }
      }
      
      // 초기 테마 즉시 적용
      applyTheme(initialTheme)

      return {
        theme: initialTheme,

        setTheme: (theme: Theme) => {
          applyTheme(theme)
          set({ theme })
        },

        toggleTheme: () => {
          const current = get().theme
          const newTheme = current === 'dark' ? 'light' : 'dark'
          applyTheme(newTheme)
          set({ theme: newTheme })
        },
      }
    },
    {
      name: 'theme-storage',
    }
  )
)
