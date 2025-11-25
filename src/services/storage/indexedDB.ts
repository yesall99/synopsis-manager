import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { Work, Synopsis, Character, Setting, TagCategory, Tag, Episode, Chapter } from '@/types'

interface NovelDB extends DBSchema {
  works: {
    key: string
    value: Work
    indexes: { 'by-title': string; 'by-updatedAt': Date }
  }
  synopses: {
    key: string
    value: Synopsis
    indexes: { 'by-title': string; 'by-updatedAt': Date; 'by-category': string; 'by-workId': string }
  }
  characters: {
    key: string
    value: Character
    indexes: { 'by-name': string; 'by-updatedAt': Date; 'by-workId': string }
  }
  settings: {
    key: string
    value: Setting
    indexes: { 'by-name': string; 'by-type': string; 'by-updatedAt': Date; 'by-workId': string }
  }
  tagCategories: {
    key: string
    value: TagCategory
    indexes: { 'by-order': number }
  }
  tags: {
    key: string
    value: Tag
    indexes: { 'by-categoryId': string; 'by-order': number }
  }
  episodes: {
    key: string
    value: Episode
    indexes: { 'by-workId': string; 'by-chapterId': string; 'by-episodeNumber': number; 'by-updatedAt': Date }
  }
  chapters: {
    key: string
    value: Chapter
    indexes: { 'by-workId': string; 'by-order': number; 'by-updatedAt': Date }
  }
}

const DB_NAME = 'novel-synopsis-db'
const DB_VERSION = 7 // 장(Chapter) 추가, Episode에서 chapter 제거하고 chapterId로 변경 (버전 강제 업그레이드)

let dbInstance: IDBPDatabase<NovelDB> | null = null
let dbPromise: Promise<IDBPDatabase<NovelDB>> | null = null

// 인덱스 추가를 위한 헬퍼 함수
async function ensureIndexes(db: IDBPDatabase<NovelDB>) {
  // 인덱스가 없으면 추가 (비동기로 처리)
  const stores = ['synopses', 'characters', 'settings'] as const
  for (const storeName of stores) {
    try {
      const store = db.transaction(storeName, 'readonly').objectStore(storeName)
      if (!store.indexNames.contains('by-workId')) {
        // 인덱스 추가는 버전 업그레이드가 필요하므로 건너뜀
        // 새로 생성되는 항목은 workId가 필수이므로 문제 없음
      }
    } catch (e) {
      // 무시
    }
  }
}

export async function getDB(): Promise<IDBPDatabase<NovelDB>> {
  if (dbInstance) {
    return dbInstance
  }

  // 이미 DB를 여는 중이면 기다림
  if (dbPromise) {
    return dbPromise
  }

  dbPromise = openDB<NovelDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Works store
      if (!db.objectStoreNames.contains('works')) {
        const workStore = db.createObjectStore('works', { keyPath: 'id' })
        workStore.createIndex('by-title', 'title')
        workStore.createIndex('by-updatedAt', 'updatedAt')
      }

      // Synopses store
      if (!db.objectStoreNames.contains('synopses')) {
        const synopsisStore = db.createObjectStore('synopses', { keyPath: 'id' })
        synopsisStore.createIndex('by-title', 'title')
        synopsisStore.createIndex('by-updatedAt', 'updatedAt')
        synopsisStore.createIndex('by-category', 'category')
        synopsisStore.createIndex('by-workId', 'workId')
      } else {
        // 기존 스토어가 있으면 workId 인덱스는 나중에 필요시 추가
        // upgrade 함수 내에서는 트랜잭션을 만들 수 없으므로 건너뜀
      }

      // Characters store
      if (!db.objectStoreNames.contains('characters')) {
        const characterStore = db.createObjectStore('characters', { keyPath: 'id' })
        characterStore.createIndex('by-name', 'name')
        characterStore.createIndex('by-updatedAt', 'updatedAt')
        characterStore.createIndex('by-workId', 'workId')
      } else {
        // 기존 스토어가 있으면 workId 인덱스는 나중에 필요시 추가
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        const settingStore = db.createObjectStore('settings', { keyPath: 'id' })
        settingStore.createIndex('by-name', 'name')
        settingStore.createIndex('by-type', 'type')
        settingStore.createIndex('by-updatedAt', 'updatedAt')
        settingStore.createIndex('by-workId', 'workId')
      } else {
        // 기존 스토어가 있으면 workId 인덱스는 나중에 필요시 추가
      }

      // Tag Categories store
      if (!db.objectStoreNames.contains('tagCategories')) {
        const categoryStore = db.createObjectStore('tagCategories', { keyPath: 'id' })
        categoryStore.createIndex('by-order', 'order')
      }

      // Tags store (새로운 구조)
      if (oldVersion < 3) {
        // 기존 tags 스토어가 있으면 삭제하고 새로 생성
        if (db.objectStoreNames.contains('tags')) {
          db.deleteObjectStore('tags')
        }
      }

      // Episodes store
      if (!db.objectStoreNames.contains('episodes')) {
        const episodeStore = db.createObjectStore('episodes', { keyPath: 'id' })
        episodeStore.createIndex('by-workId', 'workId')
        episodeStore.createIndex('by-episodeNumber', 'episodeNumber')
        episodeStore.createIndex('by-updatedAt', 'updatedAt')
        // version 6부터 by-chapterId 인덱스 추가
        if (oldVersion >= 6 || !oldVersion) {
          episodeStore.createIndex('by-chapterId', 'chapterId')
        }
      } else if (oldVersion < 6) {
        // 기존 episodes store에 by-chapterId 인덱스 추가 (버전 6 업그레이드)
        // 주의: upgrade 함수 내에서는 이미 열린 트랜잭션을 사용해야 함
        try {
          const episodeStore = db.transaction('episodes', 'readwrite').objectStore('episodes')
          if (!episodeStore.indexNames.contains('by-chapterId')) {
            // @ts-ignore - indexNames may not have contains method in all browsers
            episodeStore.createIndex('by-chapterId', 'chapterId')
          }
        } catch (e) {
          // 인덱스 추가 실패 시 무시 (이미 존재할 수 있음)
          console.warn('Failed to add by-chapterId index to episodes:', e)
        }
      }

      // Chapters store (version 6)
      if (!db.objectStoreNames.contains('chapters')) {
        const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' })
        chapterStore.createIndex('by-workId', 'workId')
        chapterStore.createIndex('by-order', 'order')
        chapterStore.createIndex('by-updatedAt', 'updatedAt')
      }

      if (!db.objectStoreNames.contains('tags')) {
        const tagStore = db.createObjectStore('tags', { keyPath: 'id' })
        tagStore.createIndex('by-categoryId', 'categoryId')
        tagStore.createIndex('by-order', 'order')
      }
    },
  })

  try {
    dbInstance = await dbPromise
    // 인덱스 확인 (필요시)
    await ensureIndexes(dbInstance)
    return dbInstance
  } catch (error) {
    dbPromise = null
    dbInstance = null
    throw error
  } finally {
    if (dbInstance) {
      dbPromise = null
    }
  }
}

// Works operations
export async function getAllWorks(): Promise<Work[]> {
  try {
    const db = await getDB()
    const works = await db.getAll('works')
    console.log('IndexedDB에서 작품 목록 로드:', works.length, '개')
    return works
  } catch (error) {
    console.error('IndexedDB에서 작품 목록 로드 실패:', error)
    throw error
  }
}

export async function getWork(id: string): Promise<Work | undefined> {
  const db = await getDB()
  return db.get('works', id)
}

export async function addWork(work: Work): Promise<void> {
  try {
    const db = await getDB()
    console.log('IndexedDB에 작품 저장 시도:', work)
    await db.put('works', work)
    console.log('IndexedDB에 작품 저장 완료')
  } catch (error) {
    console.error('IndexedDB 저장 실패:', error)
    throw error
  }
}

export async function updateWork(work: Work): Promise<void> {
  const db = await getDB()
  await db.put('works', { ...work, updatedAt: new Date(), isDirty: true })
}

export async function deleteWork(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('works', id)
}

// Synopses operations
export async function getAllSynopses(): Promise<Synopsis[]> {
  const db = await getDB()
  return db.getAll('synopses')
}

export async function getSynopsesByWorkId(workId: string): Promise<Synopsis[]> {
  const db = await getDB()
  const index = db.transaction('synopses').store.index('by-workId')
  return index.getAll(workId)
}

export async function getSynopsis(id: string): Promise<Synopsis | undefined> {
  const db = await getDB()
  return db.get('synopses', id)
}

export async function addSynopsis(synopsis: Synopsis): Promise<void> {
  const db = await getDB()
  await db.put('synopses', synopsis)
}

export async function updateSynopsis(synopsis: Synopsis): Promise<void> {
  const db = await getDB()
  await db.put('synopses', { ...synopsis, updatedAt: new Date(), isDirty: true })
}

export async function deleteSynopsis(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('synopses', id)
}

export async function searchSynopses(query: string): Promise<Synopsis[]> {
  const db = await getDB()
  const all = await db.getAll('synopses')
  const lowerQuery = query.toLowerCase()
  return all.filter(
    (s) => {
      // @ts-ignore - Old code compatibility
      const title = (s as any).title || ''
      // @ts-ignore
      const content = (s as any).content || ''
      // @ts-ignore
      const tags = (s as any).tags || []
      return title.toLowerCase().includes(lowerQuery) ||
        content.toLowerCase().includes(lowerQuery) ||
        tags.some((tag: any) => tag.toLowerCase().includes(lowerQuery))
    }
  )
}

// Characters operations
export async function getAllCharacters(): Promise<Character[]> {
  const db = await getDB()
  return db.getAll('characters')
}

export async function getCharactersByWorkId(workId: string): Promise<Character[]> {
  const db = await getDB()
  const index = db.transaction('characters').store.index('by-workId')
  return index.getAll(workId)
}

export async function getCharacter(id: string): Promise<Character | undefined> {
  const db = await getDB()
  return db.get('characters', id)
}

export async function addCharacter(character: Character): Promise<void> {
  const db = await getDB()
  await db.put('characters', character)
}

export async function updateCharacter(character: Character): Promise<void> {
  const db = await getDB()
  await db.put('characters', { ...character, updatedAt: new Date(), isDirty: true })
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('characters', id)
}

// Settings operations
export async function getAllSettings(): Promise<Setting[]> {
  const db = await getDB()
  return db.getAll('settings')
}

export async function getSettingsByWorkId(workId: string): Promise<Setting[]> {
  const db = await getDB()
  const index = db.transaction('settings').store.index('by-workId')
  return index.getAll(workId)
}

export async function getSetting(id: string): Promise<Setting | undefined> {
  const db = await getDB()
  return db.get('settings', id)
}

export async function addSetting(setting: Setting): Promise<void> {
  const db = await getDB()
  await db.put('settings', setting)
}

export async function updateSetting(setting: Setting): Promise<void> {
  const db = await getDB()
  await db.put('settings', { ...setting, updatedAt: new Date(), isDirty: true })
}

export async function deleteSetting(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('settings', id)
}

// Episodes
export async function getAllEpisodes(): Promise<Episode[]> {
  const db = await getDB()
  return db.getAll('episodes')
}

export async function getEpisodesByWorkId(workId: string): Promise<Episode[]> {
  const db = await getDB()
  const index = db.transaction('episodes').store.index('by-workId')
  return index.getAll(workId)
}

export async function getEpisode(id: string): Promise<Episode | undefined> {
  const db = await getDB()
  return db.get('episodes', id)
}

export async function addEpisode(episode: Episode): Promise<void> {
  const db = await getDB()
  await db.put('episodes', episode)
}

export async function updateEpisode(episode: Episode): Promise<void> {
  const db = await getDB()
  await db.put('episodes', episode)
}

export async function deleteEpisode(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('episodes', id)
}

// Chapters
export async function getAllChapters(): Promise<Chapter[]> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('chapters')) {
    return []
  }
  return db.getAll('chapters')
}

export async function getChaptersByWorkId(workId: string): Promise<Chapter[]> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('chapters')) {
    return []
  }
  const index = db.transaction('chapters').store.index('by-workId')
  return index.getAll(workId)
}

export async function getChapter(id: string): Promise<Chapter | undefined> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('chapters')) {
    return undefined
  }
  return db.get('chapters', id)
}

export async function addChapter(chapter: Chapter): Promise<void> {
  const db = await getDB()
  if (!db.objectStoreNames.contains('chapters')) {
    throw new Error('chapters store does not exist. Please refresh the page to upgrade the database.')
  }
  await db.put('chapters', chapter)
}

export async function updateChapter(chapter: Chapter): Promise<void> {
  const db = await getDB()
  await db.put('chapters', { ...chapter, updatedAt: new Date(), isDirty: true })
}

export async function deleteChapter(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('chapters', id)
}

// Tag Categories operations
export async function getAllTagCategories(): Promise<TagCategory[]> {
  const db = await getDB()
  const categories = await db.getAll('tagCategories')
  return categories.sort((a, b) => a.order - b.order)
}

export async function getTagCategory(id: string): Promise<TagCategory | undefined> {
  const db = await getDB()
  return db.get('tagCategories', id)
}

export async function addTagCategory(category: TagCategory): Promise<void> {
  const db = await getDB()
  await db.put('tagCategories', category)
}

export async function updateTagCategory(category: TagCategory): Promise<void> {
  const db = await getDB()
  await db.put('tagCategories', { ...category, updatedAt: new Date() })
}

export async function deleteTagCategory(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('tagCategories', id)
}

// Tags operations
export async function getAllTags(): Promise<Tag[]> {
  const db = await getDB()
  return db.getAll('tags')
}

export async function getTagsByCategoryId(categoryId: string): Promise<Tag[]> {
  const db = await getDB()
  const index = db.transaction('tags').store.index('by-categoryId')
  const tags = await index.getAll(categoryId)
  return tags.sort((a, b) => a.order - b.order)
}

export async function getTag(id: string): Promise<Tag | undefined> {
  const db = await getDB()
  return db.get('tags', id)
}

export async function addTag(tag: Tag): Promise<void> {
  const db = await getDB()
  await db.put('tags', tag)
}

export async function updateTag(tag: Tag): Promise<void> {
  const db = await getDB()
  await db.put('tags', { ...tag, updatedAt: new Date() })
}

export async function deleteTag(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('tags', id)
}

export async function updateTagCount(tagName: string, count: number, color?: string): Promise<void> {
  const db = await getDB()
  // @ts-ignore - count is not part of Tag type but used for display
  await db.put('tags', { name: tagName, count, color })
}

