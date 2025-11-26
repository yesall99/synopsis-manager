import { getNotionClient, syncToNotion } from '@/services/sync/notion'
import { workService } from '@/services/storage/storageService'
import { synopsisService } from '@/services/storage/storageService'
import { characterService } from '@/services/storage/storageService'
import { settingService } from '@/services/storage/storageService'
import { episodeService } from '@/services/storage/storageService'
import { chapterService } from '@/services/storage/storageService'
import { tagService } from '@/services/storage/storageService'
import { useToastStore } from '@/stores/toastStore'

/**
 * 노션 동기화를 백그라운드로 실행
 * 토스트를 통해 상태를 표시
 */
export async function syncToNotionInBackground(): Promise<void> {
  // 노션 연결 확인
  const apiKey = localStorage.getItem('notionApiKey')
  const pageId = localStorage.getItem('notionRootPageId')
  
  if (!apiKey || !pageId) {
    // 연결되지 않았으면 조용히 종료
    return
  }
  
  const toastId = useToastStore.getState().addToast('노션 동기화 중...', 'loading', { dismissible: false })
  
  try {
    const client = getNotionClient()
    if (!client) {
      throw new Error('노션 클라이언트를 생성할 수 없습니다.')
    }
    
    // 데이터 로드
    const works = await workService.getAll()
    const synopses = await synopsisService.getAll()
    const characters = await characterService.getAll()
    const settings = await settingService.getAll()
    const episodes = await episodeService.getAll()
    const chapters = await chapterService.getAll()
    // @ts-ignore - tagService.getAll()의 반환 타입이 Tag[]와 다를 수 있음
    const tags = await tagService.getAll()
    
    // 동기화 실행
    await syncToNotion(client, {
      works,
      synopses,
      characters,
      settings,
      episodes,
      chapters,
      tags: tags as any, // 타입 변환
    })
    
    // 성공 토스트
    useToastStore.getState().removeToast(toastId)
    useToastStore.getState().addToast('노션 동기화 완료', 'success')
  } catch (error) {
    console.error('노션 동기화 실패:', error)
    useToastStore.getState().removeToast(toastId)
    useToastStore.getState().addToast(
      error instanceof Error ? error.message : '노션 동기화에 실패했습니다.',
      'error'
    )
  }
}

