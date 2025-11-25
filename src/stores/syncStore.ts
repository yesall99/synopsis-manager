import { create } from 'zustand'
import { User } from 'firebase/auth'
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  getCurrentUser,
  syncAll,
} from '@/services/sync/firebase'
import { synopsisService } from '@/services/storage/storageService'
import { characterService } from '@/services/storage/storageService'
import { settingService } from '@/services/storage/storageService'
import type { SyncResult } from '@/services/sync/firebase'

interface SyncState {
  user: User | null
  isAuthenticated: boolean
  isSyncing: boolean
  lastSyncedAt: Date | null
  syncProgress: number
  syncError: string | null
  syncResult: SyncResult | null

  // Actions
  initialize: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  sync: () => Promise<void>
  clearSyncError: () => void
}

export const useSyncStore = create<SyncState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isSyncing: false,
  lastSyncedAt: null,
  syncProgress: 0,
  syncError: null,
  syncResult: null,

  initialize: () => {
    try {
      const currentUser = getCurrentUser()
      set({ user: currentUser, isAuthenticated: !!currentUser })

      // 인증 상태 변경 감지
      const unsubscribe = onAuthChange((user) => {
        set({ user, isAuthenticated: !!user })
      })
      // unsubscribe는 나중에 정리할 수 있도록 저장할 수도 있지만,
      // 앱이 종료될 때까지 유지하는 것이 일반적이므로 여기서는 저장하지 않음
    } catch (error) {
      // Firebase가 설정되지 않은 경우 무시
      console.warn('Firebase 초기화 실패 (선택적 기능):', error)
      set({ user: null, isAuthenticated: false })
    }
  },

  signIn: async () => {
    try {
      const user = await signInWithGoogle()
      set({ user, isAuthenticated: true, syncError: null })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그인에 실패했습니다.'
      set({ syncError: errorMessage })
      throw error
    }
  },

  signOut: async () => {
    try {
      await signOutUser()
      set({ user: null, isAuthenticated: false, syncError: null })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '로그아웃에 실패했습니다.'
      set({ syncError: errorMessage })
      throw error
    }
  },

  sync: async () => {
    const { user, isAuthenticated } = get()
    if (!isAuthenticated || !user) {
      set({ syncError: '로그인이 필요합니다.' })
      throw new Error('로그인이 필요합니다.')
    }

    set({ isSyncing: true, syncProgress: 0, syncError: null })

    try {
      // 로컬 데이터 가져오기
      set({ syncProgress: 20 })
      const [localSynopses, localCharacters, localSettings] = await Promise.all([
        synopsisService.getAll(),
        characterService.getAll(),
        settingService.getAll(),
      ])

      set({ syncProgress: 40 })

      // 동기화 실행
      const result = await syncAll(
        {
          synopses: localSynopses,
          characters: localCharacters,
          settings: localSettings,
        },
        user.uid
      )

      set({ syncProgress: 80 })

      // 클라우드에서 가져온 데이터를 로컬에 저장 (충돌 없는 경우)
      // TODO: 충돌 해결 로직 추가 필요

      set({
        syncProgress: 100,
        lastSyncedAt: new Date(),
        syncResult: result,
        isSyncing: false,
      })

      // 동기화 완료 후 로컬 데이터 새로고침
      setTimeout(() => {
        set({ syncProgress: 0, syncResult: null })
      }, 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '동기화에 실패했습니다.'
      set({
        syncError: errorMessage,
        isSyncing: false,
        syncProgress: 0,
      })
      throw error
    }
  },

  clearSyncError: () => {
    set({ syncError: null })
  },
}))

