import { create } from 'zustand'
import { tagCategoryService, tagService } from '@/services/storage/tagService'
import type { TagCategory, Tag, TagCategoryInput, TagInput } from '@/types'

interface TagStore {
  categories: TagCategory[]
  tags: Tag[]
  isLoading: boolean
  error: string | null

  // Actions
  loadCategories: () => Promise<void>
  loadTags: () => Promise<void>
  createCategory: (input: TagCategoryInput) => Promise<TagCategory>
  updateCategory: (id: string, input: Partial<TagCategoryInput>) => Promise<TagCategory>
  deleteCategory: (id: string) => Promise<void>
  createTag: (input: TagInput) => Promise<Tag>
  updateTag: (id: string, input: Partial<TagInput>) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
}

export const useTagStore = create<TagStore>((set, get) => ({
  categories: [],
  tags: [],
  isLoading: false,
  error: null,

  loadCategories: async () => {
    set({ isLoading: true, error: null })
    try {
      const categories = await tagCategoryService.getAll()
      set({ categories, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '태그 카테고리를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  loadTags: async () => {
    set({ isLoading: true, error: null })
    try {
      const tags = await tagService.getAll()
      set({ tags, isLoading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '태그를 불러오는데 실패했습니다.',
        isLoading: false,
      })
    }
  },

  createCategory: async (input: TagCategoryInput) => {
    try {
      const category = await tagCategoryService.create(input)
      set((state) => ({
        categories: [...state.categories, category].sort((a, b) => a.order - b.order),
      }))
      return category
    } catch (error) {
      throw error
    }
  },

  updateCategory: async (id: string, input: Partial<TagCategoryInput>) => {
    try {
      const updated = await tagCategoryService.update(id, input)
      set((state) => ({
        categories: state.categories
          .map((c) => (c.id === id ? updated : c))
          .sort((a, b) => a.order - b.order),
      }))
      return updated
    } catch (error) {
      throw error
    }
  },

  deleteCategory: async (id: string) => {
    try {
      await tagCategoryService.delete(id)
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
        tags: state.tags.filter((t) => t.categoryId !== id),
      }))
    } catch (error) {
      throw error
    }
  },

  createTag: async (input: TagInput) => {
    try {
      const tag = await tagService.create(input)
      set((state) => ({
        tags: [...state.tags, tag].sort((a, b) => a.order - b.order),
      }))
      return tag
    } catch (error) {
      throw error
    }
  },

  updateTag: async (id: string, input: Partial<TagInput>) => {
    try {
      const updated = await tagService.update(id, input)
      set((state) => ({
        tags: state.tags
          .map((t) => (t.id === id ? updated : t))
          .sort((a, b) => a.order - b.order),
      }))
      return updated
    } catch (error) {
      throw error
    }
  },

  deleteTag: async (id: string) => {
    try {
      await tagService.delete(id)
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
      }))
    } catch (error) {
      throw error
    }
  },
}))

