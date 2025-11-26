import { Client } from '@notionhq/client'
import type { Work, Synopsis, Character, Setting, Episode, Chapter, Tag } from '@/types'

// Cloudflare Pages Functions 프록시를 사용하는 노션 API 클라이언트
// 개발/프로덕션 환경 모두 `/api/notion` 프록시를 통해 호출합니다.
const getProxyUrl = (path: string): string => {
  // 개발 환경에서는 Vite 프록시 사용, 프로덕션에서는 Cloudflare Pages Functions 사용
  return `/api/notion/${path}`
}

// 커스텀 fetch 함수: 프록시를 통해 노션 API 호출
const proxyFetch = async (url: string, options?: any): Promise<Response> => {
  const apiKey = localStorage.getItem('notionApiKey')
  if (!apiKey) {
    throw new Error('Notion API key not found')
  }

  // 노션 API URL에서 경로 추출
  const notionApiBase = 'https://api.notion.com/v1/'
  let path = ''
  if (url.startsWith(notionApiBase)) {
    path = url.replace(notionApiBase, '')
  } else {
    // 이미 프록시 URL인 경우
    const urlObj = new URL(url, window.location.origin)
    path = urlObj.pathname.replace('/api/notion/', '')
  }
  
  // 프록시 URL로 변환
  const proxyUrl = getProxyUrl(path)
  
  // 헤더 정규화 (대소문자 구분 없이)
  const headers = new Headers(options?.headers || {})
  
  // Authorization 헤더 확인 및 설정
  // 노션 클라이언트가 auth 옵션을 사용하면 내부적으로 Authorization 헤더를 추가할 수 있음
  const existingAuth = headers.get('Authorization') || headers.get('authorization')
  if (!existingAuth) {
    headers.set('Authorization', `Bearer ${apiKey}`)
  }
  
  // Notion-Version 헤더 확인 및 설정
  if (!headers.get('Notion-Version') && !headers.get('notion-version')) {
    headers.set('Notion-Version', '2022-06-28')
  }
  
  // Content-Type 헤더 확인 및 설정
  if (!headers.get('Content-Type') && !headers.get('content-type')) {
    headers.set('Content-Type', 'application/json')
  }
  
  // 프록시를 통해 요청
  return fetch(proxyUrl, {
    method: options?.method || 'GET',
    headers: headers,
    body: options?.body,
  })
}

// 노션 API 클라이언트 가져오기
export function getNotionClient(): Client | null {
  const apiKey = localStorage.getItem('notionApiKey')
  if (!apiKey) {
    return null
  }
  
  // 커스텀 fetch를 사용하는 클라이언트 생성
  return new Client({ 
    auth: apiKey,
    fetch: proxyFetch,
  })
}

// 노션 데이터베이스 ID 저장/불러오기
const NOTION_DB_IDS_KEY = 'notionDatabaseIds'

interface NotionDatabaseIds {
  works?: string
  synopses?: string
  characters?: string
  settings?: string
  episodes?: string
  chapters?: string
  tags?: string
}

export function getNotionDatabaseIds(): NotionDatabaseIds {
  const saved = localStorage.getItem(NOTION_DB_IDS_KEY)
  return saved ? JSON.parse(saved) : {}
}

export function setNotionDatabaseIds(ids: NotionDatabaseIds): void {
  localStorage.setItem(NOTION_DB_IDS_KEY, JSON.stringify(ids))
}

// 작품 ID -> 노션 페이지 ID 매핑 저장/불러오기
const NOTION_WORK_PAGE_MAP_KEY = 'notionWorkPageMap'

interface NotionWorkPageMap {
  [workId: string]: {
    workPageId: string
    synopsisPageId?: string
    charactersPageId?: string
    settingsPageId?: string
    serialPageId?: string
    chapterPageIds?: Record<string, string> // chapterId -> pageId
    characterPageIds?: Record<string, string> // characterId -> pageId
    settingPageIds?: Record<string, string> // settingId -> pageId
    episodePageIds?: Record<string, string> // episodeId -> pageId
  }
  // 태그 페이지 ID 매핑
  __tags_page__?: {
    workPageId: string
    tagPageIds?: Record<string, string> // tagId -> pageId
  }
}

export function getNotionWorkPageMap(): NotionWorkPageMap {
  const saved = localStorage.getItem(NOTION_WORK_PAGE_MAP_KEY)
  return saved ? JSON.parse(saved) : {}
}

export function setNotionWorkPageMap(map: NotionWorkPageMap): void {
  localStorage.setItem(NOTION_WORK_PAGE_MAP_KEY, JSON.stringify(map))
}

export function updateNotionWorkPage(workId: string, pageIds: {
  workPageId?: string
  synopsisPageId?: string
  charactersPageId?: string
  settingsPageId?: string
  serialPageId?: string
  chapterPageIds?: Record<string, string>
  characterPageIds?: Record<string, string>
  settingPageIds?: Record<string, string>
  episodePageIds?: Record<string, string>
  tagPageIds?: Record<string, string>
}): void {
  const map = getNotionWorkPageMap()
  if (!map[workId]) {
    map[workId] = { workPageId: '' } as any
  }
  map[workId] = { ...map[workId], ...pageIds } as any
  setNotionWorkPageMap(map)
}

// 하위 페이지 업데이트 헬퍼 함수
async function updateOrCreatePage(
  client: Client,
  parentPageId: string,
  pageId: string | undefined,
  title: string,
  children: any[]
): Promise<string> {
  if (pageId) {
    // 기존 페이지 업데이트 시도
    try {
      // 페이지가 아카이브되어 있는지 확인
      const existingPage = await client.pages.retrieve({ page_id: pageId })
      if ((existingPage as any).archived) {
        console.warn(`페이지가 아카이브되어 있습니다. 새로 생성합니다: ${pageId}`)
        // 아카이브된 페이지는 새로 생성 (기존 ID는 무효화됨)
      } else {
        // 제목 업데이트
        await client.pages.update({
          page_id: pageId,
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
          },
        })
        
        // 기존 블록 삭제 (아카이브되지 않은 것만)
        try {
          const existingBlocks = await client.blocks.children.list({ block_id: pageId })
          for (const block of existingBlocks.results) {
            try {
              // 블록이 아카이브되어 있지 않은지 확인
              if (!(block as any).archived) {
                await client.blocks.delete({ block_id: block.id })
              }
            } catch (e) {
              // 삭제 실패는 무시 (아카이브된 블록 등)
            }
          }
        } catch (blockError) {
          // 블록 목록 가져오기 실패는 무시하고 계속 진행
          console.warn('기존 블록 목록 가져오기 실패:', blockError)
        }
        
        // 새 블록 추가
        if (children.length > 0) {
          try {
            await client.blocks.children.append({
              block_id: pageId,
              children,
            })
          } catch (appendError) {
            // 블록 추가 실패는 무시하고 계속 진행
            console.warn('블록 추가 실패:', appendError)
          }
        }
        
        // 업데이트 성공 - 기존 페이지 ID 반환
        return pageId
      }
    } catch (error: any) {
      // 아카이브 오류인 경우에만 새로 생성
      if (error?.message?.includes('archived')) {
        console.warn(`아카이브된 페이지입니다. 새로 생성합니다: ${pageId}`)
        // 아카이브된 경우에만 새로 생성 (기존 ID는 무효화됨)
      } else {
        // 다른 오류는 로그만 남기고 기존 페이지 ID 유지
        console.error(`페이지 업데이트 실패, 기존 페이지 ID 유지:`, error)
        return pageId // 기존 페이지 ID 반환 (새로 생성하지 않음)
      }
    }
  }
  
  // 새 페이지 생성 (기존 페이지가 없거나 아카이브된 경우만)
  try {
    const newPage = await client.pages.create({
      parent: { page_id: parentPageId },
      properties: {
        title: {
          title: [{ text: { content: title } }],
        },
      },
      children,
    })
    return newPage.id
  } catch (createError: any) {
    // 부모 페이지가 아카이브되어 있는 경우
    if (createError?.message?.includes('archived')) {
      throw new Error(`부모 페이지가 아카이브되어 있어서 페이지를 생성할 수 없습니다.`)
    }
    throw createError
  }
}

// 노션 데이터베이스 생성
export async function createNotionDatabase(
  client: Client,
  parentPageId: string,
  title: string,
  properties: any
): Promise<string> {
  try {
    const createParams = {
      parent: {
        type: 'page_id' as const,
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text' as const,
          text: {
            content: title,
          },
        },
      ],
      // @ts-ignore - Notion API types may not match exactly
      properties: properties,
    }
    
    console.log('데이터베이스 생성 요청:', JSON.stringify(createParams, null, 2))
    
    const response = await client.databases.create(createParams)
    
    console.log('데이터베이스 생성 응답 ID:', response.id)
    
    // 생성 직후 속성 확인
    try {
      const createdDb = await client.databases.retrieve({ database_id: response.id })
      // @ts-ignore
      const createdProps = createdDb.properties || {}
      console.log('생성 직후 데이터베이스 속성:', Object.keys(createdProps))
      
      if (Object.keys(createdProps).length === 0) {
        console.error('경고: 데이터베이스가 생성되었지만 속성이 없습니다!')
        console.error('생성 요청 속성:', Object.keys(properties))
      }
    } catch (checkError) {
      console.warn('생성 직후 속성 확인 실패:', checkError)
    }
    
    return response.id
  } catch (error) {
    console.error('노션 데이터베이스 생성 실패:', error)
    if (error instanceof Error) {
      console.error('에러 상세:', error.message)
    }
    throw error
  }
}

// 루트 페이지 ID 가져오기 (사용자가 통합을 연결한 페이지)
export function getRootPageId(): string | null {
  return localStorage.getItem('notionRootPageId')
}

export function setRootPageId(pageId: string): void {
  localStorage.setItem('notionRootPageId', pageId)
}

// 통합이 접근 가능한 페이지 목록 가져오기
// Cloudflare Workers나 서버 사이드 프록시를 통해 호출해야 합니다.
export async function getAccessiblePages(client: Client): Promise<Array<{ id: string; title: string }>> {
  try {
    // 필터 없이 모든 접근 가능한 항목 가져오기
    const response = await client.search({})
    
    const pages = response.results
      .filter((item: any) => item.object === 'page')
      .map((page: any) => {
        // 페이지 제목 추출
        let title = '제목 없음'
        
        // 노션 페이지의 제목은 properties가 아닌 다른 곳에 있을 수 있음
        // 페이지 객체를 직접 확인
        if (page.properties) {
          // properties에서 title 속성 찾기
          const titleProp = Object.values(page.properties).find((prop: any) => 
            prop.type === 'title' && prop.title && prop.title.length > 0
          ) as any
          
          if (titleProp?.title?.[0]?.plain_text) {
            title = titleProp.title[0].plain_text
          }
        }
        
        // 페이지 URL에서 제목 추출 시도 (fallback)
        if (title === '제목 없음' && page.url) {
          const urlParts = page.url.split('/')
          const lastPart = urlParts[urlParts.length - 1]
          if (lastPart && lastPart !== page.id) {
            title = decodeURIComponent(lastPart.replace(/-/g, ' '))
          }
        }
        
        return {
          id: page.id,
          title: title,
        }
      })
    
    return pages
  } catch (error) {
    console.error('노션 페이지 목록 가져오기 실패:', error)
    throw error
  }
}

// 루트 페이지 확인
export async function verifyRootPage(client: Client, pageId: string): Promise<boolean> {
  try {
    await client.pages.retrieve({ page_id: pageId })
    return true
  } catch (error) {
    console.error('노션 페이지 확인 실패:', error)
    return false
  }
}

// 데이터베이스가 존재하고 활성화되어 있는지 확인
async function verifyDatabase(client: Client, databaseId: string): Promise<boolean> {
  try {
    const database = await client.databases.retrieve({ database_id: databaseId })
    // @ts-ignore - Notion API types may not match exactly
    if (database.archived) {
      console.warn(`데이터베이스 ${databaseId}가 아카이브되어 있습니다.`)
      return false
    }
    return true
  } catch (error) {
    console.warn(`데이터베이스 ${databaseId} 확인 실패 (존재하지 않거나 접근 불가):`, error)
    return false
  }
}

// 데이터베이스가 이미 존재하는지 확인하고 속성 추가
async function ensureDatabaseProperties(
  client: Client,
  databaseId: string,
  expectedProperties: Record<string, any>
): Promise<void> {
  try {
    const database = await client.databases.retrieve({ database_id: databaseId })
    // @ts-ignore - Notion API types may not match exactly
    if (database.archived) {
      throw new Error('데이터베이스가 아카이브되어 있습니다.')
    }
    // @ts-ignore - Notion API types may not match exactly
    const existingProps = database.properties || {}
    
    console.log(`데이터베이스 ${databaseId}의 기존 속성:`, Object.keys(existingProps))
    
    // 필요한 속성들이 모두 있는지 확인
    const missingProps: Record<string, any> = {}
    for (const [propName, propDef] of Object.entries(expectedProperties)) {
      if (!existingProps[propName]) {
        missingProps[propName] = propDef
      }
    }
    
    console.log(`누락된 속성:`, Object.keys(missingProps))
    
    // 없는 속성 추가
    if (Object.keys(missingProps).length > 0) {
      try {
        // @ts-ignore - Notion API types may not match exactly
        await client.databases.update({
          database_id: databaseId,
          // @ts-ignore
          properties: missingProps,
        })
        console.log(`데이터베이스 ${databaseId}에 속성 추가 완료:`, Object.keys(missingProps))
        
        // 속성 추가 후 다시 확인
        const updatedDatabase = await client.databases.retrieve({ database_id: databaseId })
        // @ts-ignore
        const updatedProps = updatedDatabase.properties || {}
        console.log(`속성 추가 후 데이터베이스 속성:`, Object.keys(updatedProps))
        
        // 여전히 누락된 속성이 있는지 확인
        const stillMissing: string[] = []
        for (const propName of Object.keys(expectedProperties)) {
          if (!updatedProps[propName]) {
            stillMissing.push(propName)
          }
        }
        if (stillMissing.length > 0) {
          console.error(`속성 추가 후에도 여전히 누락된 속성:`, stillMissing)
          throw new Error(`속성 추가 실패: ${stillMissing.join(', ')}`)
        }
      } catch (error: any) {
        // 아카이브된 부모 페이지 오류인 경우 재시도하지 않음
        if (error?.message?.includes('archived')) {
          console.warn(`데이터베이스 ${databaseId}의 부모 페이지가 아카이브되어 있습니다.`)
          throw new Error('ARCHIVED_PARENT')
        }
        console.warn(`데이터베이스 ${databaseId}에 속성 추가 실패:`, error)
        throw error
      }
    } else {
      console.log(`모든 속성이 이미 존재합니다.`)
    }
  } catch (error: any) {
    if (error?.message === 'ARCHIVED_PARENT') {
      throw error
    }
    console.error(`데이터베이스 ${databaseId} 확인 실패:`, error)
    throw error
  }
}

// 초기 데이터베이스 설정 (작품 데이터베이스만 생성)
export async function initializeNotionDatabases(client: Client, rootPageId: string): Promise<NotionDatabaseIds> {
  // 페이지 접근 권한 확인
  const hasAccess = await verifyRootPage(client, rootPageId)
  if (!hasAccess) {
    throw new Error('노션 페이지에 접근할 수 없습니다. 통합이 해당 페이지에 연결되어 있는지 확인해주세요.')
  }

  const dbIds = getNotionDatabaseIds()
  
  // 기존 작품 데이터베이스가 있으면 유효성 및 속성 확인
  if (dbIds.works) {
    console.log('기존 작품 데이터베이스 발견. 유효성 확인 중...')
    const isValid = await verifyDatabase(client, dbIds.works)
    
    if (isValid) {
      try {
        // 데이터베이스 속성 확인
        const database = await client.databases.retrieve({ database_id: dbIds.works })
        // @ts-ignore
        const existingProps = database.properties || {}
        console.log('기존 데이터베이스 속성:', Object.keys(existingProps))
        
        // 필수 속성이 모두 있는지 확인
        const requiredProps = ['제목', '카테고리', '태그', '생성일', '수정일']
        const hasAllProps = requiredProps.every(prop => existingProps[prop])
        
        if (hasAllProps) {
          console.log('기존 데이터베이스 속성 확인 완료')
          return dbIds
        } else {
          console.warn('기존 데이터베이스에 필수 속성이 없습니다. 새로 생성합니다.')
          // 필수 속성이 없으면 새로 생성
          setNotionDatabaseIds({})
        }
      } catch (error: any) {
        console.warn('기존 데이터베이스 확인 실패, 새로 생성합니다:', error)
        setNotionDatabaseIds({})
      }
    } else {
      console.warn('기존 데이터베이스가 유효하지 않습니다. 새로 생성합니다.')
      // 유효하지 않은 데이터베이스 ID 제거
      setNotionDatabaseIds({})
    }
  }

  // 기존 데이터베이스가 없거나 속성 확인 실패 시 새로 생성
  const newDbIds: NotionDatabaseIds = {}

  // Works 데이터베이스만 생성 (하위 페이지는 작품 페이지 내부에 생성)
  newDbIds.works = await createNotionDatabase(client, rootPageId, '작품', {
    '제목': { title: {} },
    '카테고리': { rich_text: {} },
    '태그': { multi_select: { options: [] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // 생성 후 속성 확인
  try {
    const createdDb = await client.databases.retrieve({ database_id: newDbIds.works })
    // @ts-ignore
    const createdProps = createdDb.properties || {}
    console.log('생성된 데이터베이스 속성:', Object.keys(createdProps))
    
    // 필수 속성이 없으면 에러 로그만 남기고 계속 진행 (나중에 페이지 생성 시 다시 시도)
    const requiredProps = ['제목', '카테고리', '태그', '생성일', '수정일']
    const missingProps = requiredProps.filter(prop => !createdProps[prop])
    if (missingProps.length > 0) {
      console.warn('데이터베이스 생성 후에도 속성이 없습니다:', missingProps)
      console.warn('페이지 생성 시 속성을 다시 확인하고 필요시 재생성합니다.')
    }
  } catch (error) {
    console.warn('생성된 데이터베이스 속성 확인 실패:', error)
  }

  setNotionDatabaseIds(newDbIds)
  return newDbIds
}

// 데이터를 노션 형식으로 변환
function workToNotionProperties(work: Work, workPageId?: string): any {
  return {
    '제목': {
      title: [{ text: { content: work.title } }],
    },
    '카테고리': {
      rich_text: work.category ? [{ text: { content: work.category } }] : [],
    },
    '태그': {
      multi_select: work.tags.map(tag => ({ name: tag })),
    },
    '생성일': {
      date: work.createdAt ? { start: work.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: work.updatedAt ? { start: work.updatedAt.toISOString() } : null,
    },
  }
}

function synopsisToNotionProperties(synopsis: Synopsis, workPageId: string): any {
  // 기/승/전/결 구조를 JSON 문자열로 변환
  const structureJson = JSON.stringify(synopsis.structure)
  
  return {
    '작품': {
      relation: [{ id: workPageId }],
    },
    '구조': {
      rich_text: [{ text: { content: structureJson } }],
    },
    '생성일': {
      date: synopsis.createdAt ? { start: synopsis.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: synopsis.updatedAt ? { start: synopsis.updatedAt.toISOString() } : null,
    },
  }
}

function characterToNotionProperties(character: Character, workPageId: string): any {
  return {
    '이름': {
      title: [{ text: { content: character.name } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '역할': {
      rich_text: character.role ? [{ text: { content: character.role } }] : [],
    },
    '주연 여부': {
      checkbox: character.isMainCharacter || false,
    },
    '설명': {
      rich_text: character.description ? [{ text: { content: character.description } }] : [],
    },
    '생성일': {
      date: character.createdAt ? { start: character.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: character.updatedAt ? { start: character.updatedAt.toISOString() } : null,
    },
  }
}

function settingToNotionProperties(setting: Setting, workPageId: string): any {
  const typeMap: Record<string, string> = {
    'world': '세계관',
    'location': '장소',
    'time': '시간',
    'other': '기타',
  }
  
  return {
    '이름': {
      title: [{ text: { content: setting.name } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '유형': {
      select: setting.type ? { name: typeMap[setting.type] || '기타' } : null,
    },
    '설명': {
      rich_text: setting.description ? [{ text: { content: setting.description } }] : [],
    },
    '생성일': {
      date: setting.createdAt ? { start: setting.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: setting.updatedAt ? { start: setting.updatedAt.toISOString() } : null,
    },
  }
}

function chapterToNotionProperties(chapter: Chapter, workPageId: string): any {
  const structureMap: Record<string, string> = {
    'gi': '기',
    'seung': '승',
    'jeon': '전',
    'gyeol': '결',
  }
  
  return {
    '제목': {
      title: [{ text: { content: chapter.title } }],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '구조 구분': {
      select: chapter.structureType ? { name: structureMap[chapter.structureType] || null } : null,
    },
    '생성일': {
      date: chapter.createdAt ? { start: chapter.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: chapter.updatedAt ? { start: chapter.updatedAt.toISOString() } : null,
    },
  }
}

function episodeToNotionProperties(episode: Episode, workPageId: string, chapterPageId?: string): any {
  return {
    '회차 번호': {
      number: episode.episodeNumber,
    },
    '제목': {
      title: episode.title ? [{ text: { content: episode.title } }] : [],
    },
    '작품': {
      relation: [{ id: workPageId }],
    },
    '장': {
      relation: chapterPageId ? [{ id: chapterPageId }] : [],
    },
    '내용': {
      rich_text: episode.content ? [{ text: { content: episode.content.replace(/<[^>]*>/g, '') } }] : [],
    },
    '글자수': {
      number: episode.wordCount || null,
    },
    '글자수(공백제외)': {
      number: null, // TODO: wordCountWithoutSpaces 필드 추가 필요
    },
    '선작수': {
      number: episode.subscriberCount || null,
    },
    '조회수': {
      number: episode.viewCount || null,
    },
    '생성일': {
      date: episode.createdAt ? { start: episode.createdAt.toISOString() } : null,
    },
    '수정일': {
      date: episode.updatedAt ? { start: episode.updatedAt.toISOString() } : null,
    },
  }
}

// 노션에서 데이터 가져오기 (간단한 버전)
export async function syncToNotion(
  client: Client,
  data: {
    works: Work[]
    synopses: Synopsis[]
    characters: Character[]
    settings: Setting[]
    episodes: Episode[]
    chapters: Chapter[]
    tags: Tag[]
  }
): Promise<void> {
  console.log('=== 노션 동기화 시작 ===')
  console.log('노션 동기화 데이터:', {
    works: data.works.length,
    synopses: data.synopses.length,
    characters: data.characters.length,
    settings: data.settings.length,
    episodes: data.episodes.length,
    chapters: data.chapters.length,
    tags: data.tags.length,
  })

  // 데이터베이스는 더 이상 사용하지 않음 (일반 페이지로 작품 생성)

  // 작품별로 페이지 ID 매핑 저장
  const workPageMap = new Map<string, string>()
  const serialPageMap = new Map<string, string>() // 연재 페이지 ID 매핑
  const chapterPageMap = new Map<string, string>()

  // 루트 페이지 ID 가져오기
  const rootPageId = getRootPageId()
  if (!rootPageId) {
    throw new Error('Root page ID is required. Please connect to Notion first.')
  }

  // 1. Works 동기화 (일반 페이지로 생성 - 데이터베이스 속성 문제 우회)
  console.log(`작품 ${data.works.length}개 동기화 시작...`)
  
  if (data.works.length === 0) {
    console.warn('동기화할 작품이 없습니다.')
    return
  }
  
  // 기존 페이지 ID 매핑 불러오기
  const existingPageMap = getNotionWorkPageMap()
  
  for (const work of data.works) {
    try {
      console.log(`작품 "${work.title}" 동기화 시도 중...`)
      
      const existingPageIds = existingPageMap[work.id]
      let workPageId: string
      
      if (existingPageIds?.workPageId) {
        // 기존 페이지가 있으면 업데이트
        try {
          // 페이지 제목 업데이트
          await client.pages.update({
            page_id: existingPageIds.workPageId,
            properties: {
              title: {
                title: [{ text: { content: work.title || '제목 없음' } }],
              },
            },
          })
          
          // 기존 블록 삭제 후 새로 생성
          const existingBlocks = await client.blocks.children.list({ block_id: existingPageIds.workPageId })
          for (const block of existingBlocks.results) {
            try {
              await client.blocks.delete({ block_id: block.id })
            } catch (e) {
              // 삭제 실패는 무시
            }
          }
          
          // 새 블록 추가
          await client.blocks.children.append({
            block_id: existingPageIds.workPageId,
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `카테고리: ${work.category || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `태그: ${work.tags?.join(', ') || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `생성일: ${work.createdAt?.toISOString() || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `수정일: ${work.updatedAt?.toISOString() || '없음'}` } },
                  ],
                },
              },
            ],
          })
          
          workPageId = existingPageIds.workPageId
          console.log(`작품 "${work.title}" 업데이트 완료 (ID: ${workPageId})`)
        } catch (updateError) {
          console.warn(`작품 "${work.title}" 업데이트 실패, 새로 생성합니다:`, updateError)
          // 업데이트 실패 시 새로 생성
          const workPage = await client.pages.create({
            parent: { page_id: rootPageId },
            properties: {
              title: {
                title: [{ text: { content: work.title || '제목 없음' } }],
              },
            },
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `카테고리: ${work.category || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `태그: ${work.tags?.join(', ') || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `생성일: ${work.createdAt?.toISOString() || '없음'}` } },
                  ],
                },
              },
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    { type: 'text', text: { content: `수정일: ${work.updatedAt?.toISOString() || '없음'}` } },
                  ],
                },
              },
            ],
          })
          workPageId = workPage.id
          console.log(`작품 "${work.title}" 생성 완료 (ID: ${workPageId})`)
        }
      } else {
        // 기존 페이지가 없으면 새로 생성
        const workPage = await client.pages.create({
          parent: { page_id: rootPageId },
          properties: {
            title: {
              title: [{ text: { content: work.title || '제목 없음' } }],
            },
          },
          children: [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `카테고리: ${work.category || '없음'}` } },
                ],
              },
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `태그: ${work.tags?.join(', ') || '없음'}` } },
                ],
              },
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `생성일: ${work.createdAt?.toISOString() || '없음'}` } },
                ],
              },
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `수정일: ${work.updatedAt?.toISOString() || '없음'}` } },
                ],
              },
            },
          ],
        })
        workPageId = workPage.id
        console.log(`작품 "${work.title}" 생성 완료 (ID: ${workPageId})`)
      }
      
      workPageMap.set(work.id, workPageId)
      
      // 작품 페이지 내부에 연재 페이지 생성/업데이트
      let serialPageId = existingPageIds?.serialPageId
      if (!serialPageId) {
        try {
          const serialPage = await client.pages.create({
            parent: { page_id: workPageId },
            properties: {
              title: {
                title: [{ text: { content: '연재' } }],
              },
            },
          })
          serialPageId = serialPage.id
          serialPageMap.set(work.id, serialPageId)
          console.log(`작품 "${work.title}"의 연재 페이지 생성 완료`)
        } catch (error) {
          console.warn(`작품 "${work.title}"의 연재 페이지 생성 실패:`, error)
        }
      } else {
        serialPageMap.set(work.id, serialPageId)
      }
      
      // 페이지 ID 매핑 저장
      updateNotionWorkPage(work.id, {
        workPageId,
        serialPageId,
      })
    } catch (error: any) {
      console.error(`작품 ${work.id} (${work.title}) 동기화 실패:`, error)
      if (error instanceof Error) {
        console.error('에러 메시지:', error.message)
        console.error('에러 스택:', error.stack)
      }
    }
  }
  console.log(`작품 동기화 완료: ${workPageMap.size}개 성공`)

  // 2. 각 작품별로 하위 페이지 생성/업데이트
  for (const work of data.works) {
    const workPageId = workPageMap.get(work.id)
    if (!workPageId) continue

    const existingPageIds = existingPageMap[work.id] || {} as any
    const characterPageIds: Record<string, string> = (existingPageIds as any).characterPageIds || {}
    const settingPageIds: Record<string, string> = (existingPageIds as any).settingPageIds || {}
    const chapterPageIds: Record<string, string> = (existingPageIds as any).chapterPageIds || {}
    const episodePageIds: Record<string, string> = (existingPageIds as any).episodePageIds || {}

    // 2-1. 시놉시스 페이지 생성/업데이트 (작품 페이지 하위)
    const synopsis = data.synopses.find(s => s.workId === work.id)
    try {
      const structureJson = synopsis ? JSON.stringify(synopsis.structure) : '{}'
      const synopsisPageId = await updateOrCreatePage(
        client,
        workPageId,
        (existingPageIds as any).synopsisPageId,
        '시놉시스',
        [
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [
                {
                  type: 'text',
                  text: { content: structureJson },
                },
              ],
            },
          },
        ]
      )
      updateNotionWorkPage(work.id, { workPageId, synopsisPageId })
      console.log(`작품 "${work.title}"의 시놉시스 페이지 동기화 완료`)
    } catch (error) {
      console.error(`작품 "${work.title}"의 시놉시스 페이지 동기화 실패:`, error)
    }

    // 2-2. 캐릭터 페이지들 생성/업데이트 (작품 페이지 하위)
    const characters = data.characters.filter(c => c.workId === work.id)
    try {
      const charactersPageId = await updateOrCreatePage(
        client,
        workPageId,
        (existingPageIds as any).charactersPageId,
        '캐릭터',
        []
      )
      if (!(existingPageIds as any).charactersPageId) {
        updateNotionWorkPage(work.id, { workPageId, charactersPageId })
      }
      
      // 각 캐릭터를 하위 페이지로 생성/업데이트
      for (const character of characters) {
        try {
          const characterPageId = await updateOrCreatePage(
            client,
            charactersPageId,
            characterPageIds[character.id],
            character.name || '이름 없음',
            character.description ? [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: character.description },
                    },
                  ],
                },
              },
            ] : []
          )
          characterPageIds[character.id] = characterPageId
        } catch (error) {
          console.error(`캐릭터 "${character.name}" 페이지 동기화 실패:`, error)
        }
      }
      updateNotionWorkPage(work.id, { workPageId, characterPageIds })
      console.log(`작품 "${work.title}"의 캐릭터 페이지 동기화 완료 (${characters.length}개)`)
    } catch (error) {
      console.error(`작품 "${work.title}"의 캐릭터 페이지 동기화 실패:`, error)
    }

    // 2-3. 설정 페이지들 생성/업데이트 (작품 페이지 하위)
    const settings = data.settings.filter(s => s.workId === work.id)
    try {
      const settingsPageId = await updateOrCreatePage(
        client,
        workPageId,
        (existingPageIds as any).settingsPageId,
        '설정',
        []
      )
      if (!(existingPageIds as any).settingsPageId) {
        updateNotionWorkPage(work.id, { workPageId, settingsPageId })
      }
      
      // 각 설정을 하위 페이지로 생성/업데이트
      for (const setting of settings) {
        try {
          const settingPageId = await updateOrCreatePage(
            client,
            settingsPageId,
            settingPageIds[setting.id],
            setting.name || '이름 없음',
            setting.description ? [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: setting.description },
                    },
                  ],
                },
              },
            ] : []
          )
          settingPageIds[setting.id] = settingPageId
        } catch (error) {
          console.error(`설정 "${setting.name}" 페이지 동기화 실패:`, error)
        }
      }
      updateNotionWorkPage(work.id, { workPageId, settingPageIds })
      console.log(`작품 "${work.title}"의 설정 페이지 동기화 완료 (${settings.length}개)`)
    } catch (error) {
      console.error(`작품 "${work.title}"의 설정 페이지 동기화 실패:`, error)
    }

    // 2-4. 연재 페이지 내부에 장과 회차 생성/업데이트
    const serialPageId = serialPageMap.get(work.id)
    if (serialPageId) {
      const chapters = data.chapters.filter(c => c.workId === work.id)
      
      // 장별로 그룹화하여 생성/업데이트
      for (const chapter of chapters) {
        try {
          const chapterPageId = await updateOrCreatePage(
            client,
            serialPageId,
            chapterPageIds[chapter.id],
            chapter.title,
            []
          )
          chapterPageIds[chapter.id] = chapterPageId
          chapterPageMap.set(chapter.id, chapterPageId)
          
          // 해당 장의 회차들 생성/업데이트
          const episodes = data.episodes.filter(e => e.chapterId === chapter.id)
          for (const episode of episodes) {
            try {
              const episodePageId = await updateOrCreatePage(
                client,
                chapterPageId,
                episodePageIds[episode.id],
                `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
                [
                  {
                    object: 'block',
                    type: 'paragraph',
                    paragraph: {
                      rich_text: [
                        {
                          type: 'text',
                          text: { content: episode.content.replace(/<[^>]*>/g, '') || '' },
                        },
                      ],
                    },
                  },
                ]
              )
              episodePageIds[episode.id] = episodePageId
            } catch (error) {
              console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
            }
          }
          console.log(`장 "${chapter.title}" 및 회차 ${episodes.length}개 동기화 완료`)
        } catch (error) {
          console.error(`장 "${chapter.title}" 페이지 동기화 실패:`, error)
        }
      }
      
      // 장이 없는 회차들도 생성/업데이트
      const episodesWithoutChapter = data.episodes.filter(e => e.workId === work.id && !e.chapterId)
      for (const episode of episodesWithoutChapter) {
        try {
          const episodePageId = await updateOrCreatePage(
            client,
            serialPageId,
            episodePageIds[episode.id],
            `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
            [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: episode.content.replace(/<[^>]*>/g, '') || '' },
                    },
                  ],
                },
              },
            ]
          )
          episodePageIds[episode.id] = episodePageId
        } catch (error) {
          console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
        }
      }
      
      // 페이지 ID 매핑 저장
      updateNotionWorkPage(work.id, {
        workPageId,
        chapterPageIds,
        episodePageIds,
      })
    }
  }

  // 7. Tags 동기화 (루트 페이지 하위에 "태그" 페이지 생성)
  // rootPageId와 existingPageMap은 이미 위에서 선언됨
  const tagsPageIdKey = '__tags_page__'
  let tagsPageId = existingPageMap[tagsPageIdKey]?.workPageId
  
  if (!tagsPageId) {
    // 태그 페이지가 없으면 생성
    try {
      const tagsPage = await client.pages.create({
        parent: { page_id: rootPageId },
        properties: {
          title: {
            title: [{ text: { content: '태그' } }],
          },
        },
      })
      tagsPageId = tagsPage.id
      const map = getNotionWorkPageMap()
      map.__tags_page__ = { workPageId: tagsPageId, tagPageIds: {} } as any
      setNotionWorkPageMap(map)
      console.log('태그 페이지 생성 완료')
    } catch (error: any) {
      console.error('태그 페이지 생성 실패:', error)
      // 부모 페이지가 아카이브되어 있는 경우 등
      if (error?.message?.includes('archived')) {
        console.error('부모 페이지가 아카이브되어 있어서 태그 페이지를 생성할 수 없습니다.')
      }
      return // 태그 페이지 생성 실패 시 태그 동기화 중단
    }
  } else {
    // 기존 태그 페이지가 아카이브되어 있는지 확인
    try {
      const existingTagsPage = await client.pages.retrieve({ page_id: tagsPageId })
      if ((existingTagsPage as any).archived) {
        console.warn('태그 페이지가 아카이브되어 있습니다. 새로 생성합니다.')
        // 아카이브된 페이지는 새로 생성
        const tagsPage = await client.pages.create({
          parent: { page_id: rootPageId },
          properties: {
            title: {
              title: [{ text: { content: '태그' } }],
            },
          },
        })
        tagsPageId = tagsPage.id
        const map = getNotionWorkPageMap()
        map.__tags_page__ = { workPageId: tagsPageId, tagPageIds: {} } as any
        setNotionWorkPageMap(map)
        console.log('태그 페이지 재생성 완료')
      }
    } catch (error) {
      console.warn('태그 페이지 확인 실패:', error)
      // 확인 실패해도 계속 진행 (아마도 페이지가 없거나 접근 불가)
    }
  }
  
  if (data.tags.length > 0) {
    console.log(`태그 ${data.tags.length}개 동기화 시작...`)
    let tagSuccessCount = 0
    
    // 태그 페이지 ID 매핑 가져오기
    const tagsPageData = existingPageMap.__tags_page__
    const tagPageIds: Record<string, string> = tagsPageData?.tagPageIds || {}
    
    for (const tag of data.tags) {
      try {
        // 태그를 태그 페이지의 하위 페이지로 생성/업데이트
        const tagPageId = await updateOrCreatePage(
          client,
          tagsPageId,
          tagPageIds[tag.id],
          tag.name || '이름 없음',
          [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `카테고리: ${tag.categoryId || '없음'}` } },
                ],
              },
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `생성일: ${tag.createdAt?.toISOString() || '없음'}` } },
                ],
              },
            },
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  { type: 'text', text: { content: `수정일: ${tag.updatedAt?.toISOString() || '없음'}` } },
                ],
              },
            },
          ]
        )
        tagPageIds[tag.id] = tagPageId
        tagSuccessCount++
        console.log(`태그 "${tag.name}" 동기화 완료`)
      } catch (error) {
        console.error(`태그 ${tag.id} (${tag.name}) 동기화 실패:`, error)
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message)
        }
      }
    }
    
    // 태그 페이지 ID 매핑 저장
    const map = getNotionWorkPageMap()
    if (!map.__tags_page__) {
      map.__tags_page__ = { workPageId: tagsPageId, tagPageIds: {} } as any
    }
    ;(map.__tags_page__ as any).workPageId = tagsPageId
    ;(map.__tags_page__ as any).tagPageIds = tagPageIds
    setNotionWorkPageMap(map)
    console.log(`태그 동기화 완료: ${tagSuccessCount}개 성공`)
  } else {
    console.log('동기화할 태그가 없습니다.')
  }

  console.log('노션 동기화 완료!')
  console.log('작품 페이지를 열면 연결된 시놉시스, 캐릭터, 설정, 장, 회차가 Relation 속성으로 표시됩니다.')
}

// 노션에서 데이터 가져오기
export async function syncFromNotion(client: Client): Promise<{
  works: Work[]
  synopses: Synopsis[]
  characters: Character[]
  settings: Setting[]
  episodes: Episode[]
  chapters: Chapter[]
  tags: Tag[]
}> {
  const dbIds = getNotionDatabaseIds()
  const result = {
    works: [] as Work[],
    synopses: [] as Synopsis[],
    characters: [] as Character[],
    settings: [] as Setting[],
    episodes: [] as Episode[],
    chapters: [] as Chapter[],
    tags: [] as Tag[],
  }

  // TODO: 노션에서 데이터를 읽어와서 변환하는 로직 구현
  // 현재는 빈 배열 반환

  return result
}

