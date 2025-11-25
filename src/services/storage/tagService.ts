import {
  getAllTagCategories,
  getTagCategory,
  addTagCategory,
  updateTagCategory,
  deleteTagCategory,
  getAllTags,
  getTagsByCategoryId,
  getTag,
  addTag,
  updateTag,
  deleteTag,
} from './indexedDB'
import type { TagCategory, Tag, TagCategoryInput, TagInput } from '@/types'

// Tag Categories service
export const tagCategoryService = {
  async getAll(): Promise<TagCategory[]> {
    return getAllTagCategories()
  },

  async getById(id: string): Promise<TagCategory | null> {
    const category = await getTagCategory(id)
    return category || null
  },

  async create(input: TagCategoryInput): Promise<TagCategory> {
    const now = new Date()
    const category: TagCategory = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    await addTagCategory(category)
    return category
  },

  async update(id: string, input: Partial<TagCategoryInput>): Promise<TagCategory> {
    const existing = await getTagCategory(id)
    if (!existing) {
      throw new Error(`Tag category with id ${id} not found`)
    }
    const updated: TagCategory = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    }
    await updateTagCategory(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    // 해당 카테고리의 모든 태그도 삭제
    const tags = await getTagsByCategoryId(id)
    for (const tag of tags) {
      await deleteTag(tag.id)
    }
    await deleteTagCategory(id)
  },
}

// Tags service
export const tagService = {
  async getAll(): Promise<Tag[]> {
    return getAllTags()
  },

  async getByCategoryId(categoryId: string): Promise<Tag[]> {
    return getTagsByCategoryId(categoryId)
  },

  async getById(id: string): Promise<Tag | null> {
    const tag = await getTag(id)
    return tag || null
  },

  async create(input: TagInput): Promise<Tag> {
    const now = new Date()
    const tag: Tag = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }
    await addTag(tag)
    return tag
  },

  async update(id: string, input: Partial<TagInput>): Promise<Tag> {
    const existing = await getTag(id)
    if (!existing) {
      throw new Error(`Tag with id ${id} not found`)
    }
    const updated: Tag = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    }
    await updateTag(updated)
    return updated
  },

  async delete(id: string): Promise<void> {
    await deleteTag(id)
  },
}

