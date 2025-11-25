import { create } from 'zustand'
import { episodeService } from '@/services/storage/storageService'
import type { Episode, EpisodeInput } from '@/types'

interface EpisodeState {
  episodes: Episode[]
  currentEpisode: Episode | null
  isLoading: boolean
  error: string | null

  // Actions
  loadEpisodes: () => Promise<void>
  loadEpisode: (id: string) => Promise<void>
  createEpisode: (input: EpisodeInput) => Promise<Episode>
  updateEpisode: (id: string, input: Partial<EpisodeInput>) => Promise<void>
  deleteEpisode: (id: string) => Promise<void>
  clearCurrentEpisode: () => void
}

export const useEpisodeStore = create<EpisodeState>((set, get) => ({
  episodes: [],
  currentEpisode: null,
  isLoading: false,
  error: null,

  loadEpisodes: async () => {
    set({ isLoading: true, error: null })
    try {
      const episodes = await episodeService.getAll()
      set({ episodes, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '회차를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadEpisode: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const episode = await episodeService.getById(id)
      if (episode) {
        set({ currentEpisode: episode, isLoading: false })
      } else {
        set({ error: '회차를 찾을 수 없습니다.', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '회차를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createEpisode: async (input: EpisodeInput) => {
    set({ isLoading: true, error: null })
    try {
      const newEpisode = await episodeService.create(input)
      set((state) => ({
        episodes: [newEpisode, ...state.episodes],
        currentEpisode: newEpisode,
        isLoading: false,
      }))
      return newEpisode
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '회차를 생성하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  updateEpisode: async (id: string, input: Partial<EpisodeInput>) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await episodeService.update(id, input)
      set((state) => ({
        episodes: state.episodes.map((e) => (e.id === id ? updated : e)),
        currentEpisode: state.currentEpisode?.id === id ? updated : state.currentEpisode,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '회차를 업데이트하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  deleteEpisode: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      await episodeService.delete(id)
      set((state) => ({
        episodes: state.episodes.filter((e) => e.id !== id),
        currentEpisode: state.currentEpisode?.id === id ? null : state.currentEpisode,
        isLoading: false,
      }))
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '회차를 삭제하는데 실패했습니다.',
        isLoading: false,
      })
      throw error
    }
  },

  clearCurrentEpisode: () => {
    set({ currentEpisode: null })
  },
}))

