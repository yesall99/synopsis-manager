import { getNotionClient, syncToNotion } from '@/services/sync/notion'
import { workService } from '@/services/storage/storageService'
import { synopsisService } from '@/services/storage/storageService'
import { characterService } from '@/services/storage/storageService'
import { settingService } from '@/services/storage/storageService'
import { episodeService } from '@/services/storage/storageService'
import { chapterService } from '@/services/storage/storageService'
import { tagService } from '@/services/storage/storageService'
import { tagCategoryService } from '@/services/storage/tagService'
import { useToastStore } from '@/stores/toastStore'
import { getDB } from '@/services/storage/indexedDB'

// 동기화 진행 상태 추적
let syncInProgress = false
let currentSyncVersion = 0
let currentToastId: string | null = null

/**
 * 노션 동기화를 백그라운드로 실행
 * 토스트를 통해 상태를 표시
 * 동기화가 이미 진행 중이면 이전 동기화를 취소하고 새로운 동기화만 실행
 */
export async function syncToNotionInBackground(): Promise<void> {
  // 노션 연결 확인
  const apiKey = localStorage.getItem('notionApiKey')
  const pageId = localStorage.getItem('notionRootPageId')
  
  if (!apiKey || !pageId) {
    // 연결되지 않았으면 조용히 종료
    return
  }
  
  // 새로운 동기화 버전 생성 (가장 최근 동기화만 실행)
  const syncVersion = ++currentSyncVersion
  
  // 이전 토스트 제거 (새로운 동기화가 시작되면)
  if (currentToastId) {
    useToastStore.getState().removeToast(currentToastId)
  }
  
  // 동기화 진행 중이면 이전 동기화는 무시하고 새로운 것만 실행
  if (syncInProgress) {
    console.log('동기화가 이미 진행 중입니다. 이전 동기화를 취소하고 새로운 동기화를 시작합니다.')
  }
  
  syncInProgress = true
  const toastId = useToastStore.getState().addToast('노션 동기화 중...', 'loading', { dismissible: false })
  currentToastId = toastId
  
  try {
    const client = getNotionClient()
    if (!client) {
      throw new Error('노션 클라이언트를 생성할 수 없습니다.')
    }
    
    // 변경된 데이터만 로드 (isDirty가 true이거나 syncedAt이 없는 것)
    const allWorks = await workService.getAll()
    const allSynopses = await synopsisService.getAll()
    const allCharacters = await characterService.getAll()
    const allSettings = await settingService.getAll()
    const allEpisodes = await episodeService.getAll()
    const allChapters = await chapterService.getAll()
    // @ts-ignore - tagService.getAll()의 반환 타입이 Tag[]와 다를 수 있음
    const allTags = await tagService.getAll()
    const allTagCategories = await tagCategoryService.getAll()
    
    // 변경된 데이터만 필터링
    const works = allWorks.filter(w => w.isDirty || !w.syncedAt)
    const synopses = allSynopses.filter(s => s.isDirty || !s.syncedAt)
    const characters = allCharacters.filter(c => c.isDirty || !c.syncedAt)
    const settings = allSettings.filter(s => s.isDirty || !s.syncedAt)
    const episodes = allEpisodes.filter(e => e.isDirty || !e.syncedAt)
    const chapters = allChapters.filter(c => c.isDirty || !c.syncedAt)
    const tags = (allTags as any[]).filter((t: any) => t.isDirty || !t.syncedAt)
    const tagCategories = allTagCategories.filter(tc => tc.isDirty || !tc.syncedAt)
    
    // 변경된 장/회차가 있으면 해당 작품도 함께 동기화해야 함 (연재 페이지 생성/업데이트를 위해)
    const changedWorkIds = new Set(works.map(w => w.id))
    chapters.forEach(c => changedWorkIds.add(c.workId))
    episodes.forEach(e => changedWorkIds.add(e.workId))
    
    // 변경된 데이터가 없으면 동기화 건너뛰기
    const hasChanges = works.length > 0 || synopses.length > 0 || characters.length > 0 || 
                       settings.length > 0 || episodes.length > 0 || chapters.length > 0 || 
                       tags.length > 0 || tagCategories.length > 0 || changedWorkIds.size > 0
    
    if (!hasChanges) {
      console.log('변경된 데이터가 없어 동기화를 건너뜁니다.')
      useToastStore.getState().removeToast(toastId)
      syncInProgress = false
      currentToastId = null
      return
    }
    
    console.log('변경된 데이터:', {
      works: works.length,
      synopses: synopses.length,
      characters: characters.length,
      settings: settings.length,
      episodes: episodes.length,
      chapters: chapters.length,
      tags: tags.length,
      tagCategories: tagCategories.length,
      changedWorkIds: changedWorkIds.size,
    })
    
    // 변경된 작품의 관련 데이터 가져오기 (작품이 변경된 경우만)
    const relatedSynopses = allSynopses.filter(s => works.some(w => w.id === s.workId))
    const relatedCharacters = allCharacters.filter(c => works.some(w => w.id === c.workId))
    const relatedSettings = allSettings.filter(s => works.some(w => w.id === s.workId))
    
    // 변경된 장/회차가 있는 작품의 모든 장과 회차 가져오기 (연재 페이지 동기화를 위해)
    const relatedChapters = allChapters.filter(c => changedWorkIds.has(c.workId))
    const relatedEpisodes = allEpisodes.filter(e => changedWorkIds.has(e.workId))
    
    // 작품은 변경된 것만 포함 (변경되지 않은 작품은 포함하지 않음)
    const finalWorks = works
    
    // 관련 데이터를 변경된 데이터에 추가 (중복 제거)
    const finalSynopses = [...new Map([...synopses, ...relatedSynopses].map(s => [s.id, s])).values()]
    const finalCharacters = [...new Map([...characters, ...relatedCharacters].map(c => [c.id, c])).values()]
    const finalSettings = [...new Map([...settings, ...relatedSettings].map(s => [s.id, s])).values()]
    
    // 장과 회차는 변경된 것과 변경된 작품의 모든 것을 포함 (연재 페이지 동기화를 위해)
    const finalChapters = [...new Map([...chapters, ...relatedChapters].map(c => [c.id, c])).values()]
    const finalEpisodes = [...new Map([...episodes, ...relatedEpisodes].map(e => [e.id, e])).values()]
    
    // 동기화 버전 확인 (가장 최근 동기화만 실행)
    if (syncVersion !== currentSyncVersion) {
      console.log('이 동기화는 취소되었습니다. 더 최근 동기화가 실행 중입니다.')
      useToastStore.getState().removeToast(toastId)
      return
    }
    
    // 동기화 실행
    let syncedIds
    try {
      syncedIds = await syncToNotion(client, {
        works: finalWorks,
        synopses: finalSynopses,
        characters: finalCharacters,
        settings: finalSettings,
        episodes: finalEpisodes,
        chapters: finalChapters,
        tags: tags as any, // 타입 변환
        tagCategories,
      })
    } catch (syncError) {
      // 동기화 버전 확인 (에러 발생 시에도 취소되었는지 확인)
      if (syncVersion !== currentSyncVersion) {
        console.log('이 동기화는 에러가 발생했지만 취소되었습니다.')
        useToastStore.getState().removeToast(toastId)
        return
      }
      throw syncError // 에러를 다시 던짐
    }
    
    // syncedIds가 없으면 상태 업데이트 건너뛰기
    if (!syncedIds) {
      console.warn('동기화 결과가 없습니다. 상태 업데이트를 건너뜁니다.')
      useToastStore.getState().removeToast(toastId)
      useToastStore.getState().addToast('노션 동기화 완료', 'success')
      currentToastId = null
      if (syncVersion === currentSyncVersion) {
        syncInProgress = false
      }
      return
    }
    
    // 동기화 버전 확인 (완료 전에 취소되었는지 확인)
    if (syncVersion !== currentSyncVersion) {
      console.log('이 동기화는 완료되었지만 취소되었습니다.')
      useToastStore.getState().removeToast(toastId)
      return
    }
    
    // 동기화 완료 후 isDirty를 false로, syncedAt 업데이트
    const now = new Date()
    try {
      const db = await getDB()
      
      // Works 업데이트
      if (syncedIds.works && syncedIds.works.length > 0) {
        for (const id of syncedIds.works) {
          const work = await workService.getById(id)
          if (work) {
            await db.put('works', { ...work, isDirty: false, syncedAt: now })
          }
        }
      }
      
      // Synopses 업데이트
      if (syncedIds.synopses && syncedIds.synopses.length > 0) {
        for (const id of syncedIds.synopses) {
          const synopsis = await synopsisService.getById(id)
          if (synopsis) {
            await db.put('synopses', { ...synopsis, isDirty: false, syncedAt: now })
          }
        }
      }
      
      // Characters 업데이트
      if (syncedIds.characters && syncedIds.characters.length > 0) {
        for (const id of syncedIds.characters) {
          const character = await characterService.getById(id)
          if (character) {
            await db.put('characters', { ...character, isDirty: false, syncedAt: now })
          }
        }
      }
      
      // Settings 업데이트
      if (syncedIds.settings && syncedIds.settings.length > 0) {
        for (const id of syncedIds.settings) {
          const setting = await settingService.getById(id)
          if (setting) {
            await db.put('settings', { ...setting, isDirty: false, syncedAt: now })
          }
        }
      }
      
      // Episodes 업데이트
      if (syncedIds.episodes && syncedIds.episodes.length > 0) {
        for (const id of syncedIds.episodes) {
          const episode = await episodeService.getById(id)
          if (episode) {
            await db.put('episodes', { ...episode, isDirty: false, syncedAt: now })
          }
        }
      }
      
      // Chapters 업데이트
      if (syncedIds.chapters && syncedIds.chapters.length > 0) {
        for (const id of syncedIds.chapters) {
          const chapter = await chapterService.getById(id)
          if (chapter) {
            await db.put('chapters', { ...chapter, isDirty: false, syncedAt: now })
          }
        }
      }
      
      console.log('동기화 상태 업데이트 완료')
    } catch (updateError) {
      console.error('동기화 상태 업데이트 실패:', updateError)
      // 상태 업데이트 실패해도 동기화는 성공한 것으로 간주
    }
    
    // 성공 토스트
    useToastStore.getState().removeToast(toastId)
    useToastStore.getState().addToast('노션 동기화 완료', 'success')
    currentToastId = null
  } catch (error) {
    // 동기화 버전 확인 (에러 발생 시에도 취소되었는지 확인)
    if (syncVersion !== currentSyncVersion) {
      console.log('이 동기화는 에러가 발생했지만 취소되었습니다.')
      useToastStore.getState().removeToast(toastId)
      return
    }
    
    console.error('노션 동기화 실패:', error)
    useToastStore.getState().removeToast(toastId)
    useToastStore.getState().addToast(
      error instanceof Error ? error.message : '노션 동기화에 실패했습니다.',
      'error'
    )
    currentToastId = null
  } finally {
    // 현재 동기화가 가장 최근 동기화인 경우에만 상태 해제
    if (syncVersion === currentSyncVersion) {
      syncInProgress = false
      currentToastId = null
    }
  }
}

