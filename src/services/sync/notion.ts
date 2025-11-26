import { Client } from '@notionhq/client'
import type { Work, Synopsis, Character, Setting, Episode, Chapter, Tag, TagCategory } from '@/types'

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
    tagCategoryPageIds?: Record<string, string> // tagCategoryId -> pageId
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

// 배치 처리 헬퍼 함수 (rate limit 방지)
async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(processor))
    // 배치 간 짧은 지연 (rate limit 방지)
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
}

// HTML 내용을 Notion 블록으로 변환 (줄바꿈 유지)
function htmlContentToNotionBlocks(htmlContent: string): any[] {
  if (!htmlContent) return []
  
  // HTML 태그 제거 및 줄바꿈 처리
  // <br>, <br/>, <br />를 줄바꿈으로 변환
  let text = htmlContent
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '') // 나머지 HTML 태그 제거
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  // 줄바꿈으로 분리
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
  
  // 각 줄을 paragraph 블록으로 변환
  return lines.map(line => ({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        {
          type: 'text',
          text: { content: line },
        },
      ],
    },
  }))
}

// 회차 정보를 Notion 블록으로 변환
function episodeToNotionBlocks(episode: Episode): any[] {
  const blocks: any[] = []
  
  // JSON 데이터 블록 추가 (불러오기용)
  blocks.push({
    object: 'block',
    type: 'code',
    code: {
      language: 'json',
      rich_text: [
        {
          type: 'text',
          text: { content: JSON.stringify({
            id: episode.id,
            workId: episode.workId,
            chapterId: episode.chapterId,
            episodeNumber: episode.episodeNumber,
            title: episode.title,
            content: episode.content,
            wordCount: episode.wordCount,
            publishedAt: episode.publishedAt?.toISOString(),
            subscriberCount: episode.subscriberCount,
            viewCount: episode.viewCount,
            order: episode.order,
            createdAt: episode.createdAt?.toISOString(),
            updatedAt: episode.updatedAt?.toISOString(),
            syncedAt: episode.syncedAt?.toISOString(),
            isDirty: episode.isDirty,
          }, null, 2) },
        },
      ],
    },
  })
  
  // 구분선 추가
  blocks.push({
    object: 'block',
    type: 'divider',
    divider: {},
  })
  
  // 내용 블록 추가 (줄바꿈 유지, 읽기용)
  const contentBlocks = htmlContentToNotionBlocks(episode.content)
  blocks.push(...contentBlocks)
  
  return blocks
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
      // 페이지가 존재하는지 확인
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
        
        // 기존 블록 확인 및 내용 비교
        try {
          const existingBlocks = await client.blocks.children.list({ block_id: pageId })
          const activeBlocks = existingBlocks.results.filter((b: any) => !b.archived)
          
          // 새 블록 내용을 문자열로 변환 (비교용)
          const newContent = JSON.stringify(children)
          
          // 기존 블록 내용을 문자열로 변환 (비교용)
          const existingContent = JSON.stringify(
            activeBlocks.map((block: any) => {
              if (block.type === 'paragraph' && block.paragraph?.rich_text) {
                return {
                  type: 'paragraph',
                  paragraph: {
                    rich_text: block.paragraph.rich_text,
                  },
                }
              }
              return block
            })
          )
          
          // 내용이 다르면 기존 블록 삭제 후 새로 추가
          if (newContent !== existingContent) {
            // 기존 블록 삭제
            for (const block of activeBlocks) {
              try {
                await client.blocks.delete({ block_id: block.id })
              } catch (e) {
                // 삭제 실패는 무시
              }
            }
            
            // 새 블록 추가
            if (children.length > 0) {
              try {
                await client.blocks.children.append({
                  block_id: pageId,
                  children,
                })
              } catch (appendError) {
                console.warn('블록 추가 실패:', appendError)
              }
            }
          }
          // 내용이 같으면 아무것도 하지 않음
        } catch (blockError) {
          // 블록 확인 실패는 무시 (기존 내용 유지)
          console.warn('블록 확인 실패, 기존 내용 유지:', blockError)
        }
        
        // 업데이트 성공 - 기존 페이지 ID 반환
        return pageId
      }
    } catch (error: any) {
      // 페이지를 찾을 수 없는 경우 (object_not_found) 또는 아카이브 오류인 경우 새로 생성
      if ((error as any)?.code === 'object_not_found') {
        console.warn(`페이지를 찾을 수 없습니다. 새로 생성합니다: ${pageId}`)
        // 페이지가 존재하지 않으므로 새로 생성 (기존 ID는 무효화됨)
      } else if (error?.message?.includes('archived')) {
        console.warn(`페이지가 아카이브되었습니다. 새로 생성합니다: ${pageId}`)
        // 아카이브된 경우 새로 생성 (기존 ID는 무효화됨)
      } else {
        // 다른 오류는 로그만 남기고 기존 페이지 ID 유지 (새로 생성하지 않음)
        console.warn(`페이지 업데이트 실패, 기존 페이지 ID 유지:`, error)
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
    tagCategories: TagCategory[]
  }
): Promise<{
  works: string[]
  synopses: string[]
  characters: string[]
  settings: string[]
  episodes: string[]
  chapters: string[]
  tags: string[]
  tagCategories: string[]
}> {
  console.log('=== 노션 동기화 시작 ===')
  console.log('노션 동기화 데이터:', {
    works: data.works.length,
    synopses: data.synopses.length,
    characters: data.characters.length,
    settings: data.settings.length,
    episodes: data.episodes.length,
    chapters: data.chapters.length,
    tags: data.tags.length,
    tagCategories: data.tagCategories.length,
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
  
  // 작품이 없어도 장/회차가 있으면 연재 페이지 동기화를 위해 계속 진행
  if (data.works.length === 0 && data.episodes.length === 0 && data.chapters.length === 0) {
    console.warn('동기화할 데이터가 없습니다.')
    return {
      works: [],
      synopses: [],
      characters: [],
      settings: [],
      episodes: [],
      chapters: [],
      tags: [],
      tagCategories: [],
    }
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
          
          // 새 블록 내용 준비 (JSON 형태로 저장)
          const newBlocks: any[] = [
            {
              object: 'block',
              type: 'code',
              code: {
                language: 'json' as any,
                rich_text: [
                  {
                    type: 'text',
                    text: { content: JSON.stringify({
                      id: work.id,
                      title: work.title,
                      description: work.description,
                      category: work.category,
                      tags: work.tags,
                      createdAt: work.createdAt?.toISOString(),
                      updatedAt: work.updatedAt?.toISOString(),
                      syncedAt: work.syncedAt?.toISOString(),
                      isDirty: work.isDirty,
                    }, null, 2) },
                  },
                ],
              },
            },
          ]
          
          // 기존 블록 확인 및 내용 비교
          try {
            const existingBlocks = await client.blocks.children.list({ block_id: existingPageIds.workPageId })
            const activeBlocks = existingBlocks.results.filter((b: any) => !b.archived)
            
            // 새 블록 내용을 문자열로 변환 (비교용)
            const newContent = JSON.stringify(newBlocks)
            
            // 기존 블록 내용을 문자열로 변환 (비교용)
            const existingContent = JSON.stringify(
              activeBlocks.map((block: any) => {
                if (block.type === 'code' && block.code?.language === 'json') {
                  return {
                    type: 'code',
                    code: {
                      language: 'json',
                      rich_text: block.code.rich_text,
                    },
                  }
                }
                if (block.type === 'paragraph' && block.paragraph?.rich_text) {
                  return {
                    type: 'paragraph',
                    paragraph: {
                      rich_text: block.paragraph.rich_text,
                    },
                  }
                }
                return block
              })
            )
            
            // 내용이 다르면 기존 블록 삭제 후 새로 추가
            if (newContent !== existingContent) {
              // 기존 블록 삭제
              for (const block of activeBlocks) {
                try {
                  await client.blocks.delete({ block_id: block.id })
                } catch (e) {
                  // 삭제 실패는 무시
                }
              }
              
              // 새 블록 추가
              await client.blocks.children.append({
                block_id: existingPageIds.workPageId,
                children: newBlocks,
              })
            }
            // 내용이 같으면 아무것도 하지 않음
          } catch (blockError) {
            // 블록 확인 실패는 무시
            console.warn('블록 확인 실패:', blockError)
          }
          
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
              type: 'code',
              code: {
                language: 'json',
                rich_text: [
                  {
                    type: 'text',
                    text: { content: JSON.stringify({
                      id: work.id,
                      title: work.title,
                      description: work.description,
                      category: work.category,
                      tags: work.tags,
                      createdAt: work.createdAt?.toISOString(),
                      updatedAt: work.updatedAt?.toISOString(),
                      syncedAt: work.syncedAt?.toISOString(),
                      isDirty: work.isDirty,
                    }, null, 2) },
                  },
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
      
      // 연재 페이지 생성/확인 헬퍼 함수
      const createSerialPage = async () => {
        try {
          // 부모 페이지(작품 페이지)가 아카이브되어 있는지 확인
          try {
            const parentPage = await client.pages.retrieve({ page_id: workPageId })
            if ((parentPage as any).archived) {
              console.warn(`작품 "${work.title}" 페이지가 아카이브되어 있습니다. 복구합니다.`)
              await client.pages.update({
                page_id: workPageId,
                archived: false,
              })
              console.log(`작품 "${work.title}" 페이지 복구 완료`)
            }
          } catch (parentError) {
            console.warn(`작품 "${work.title}" 페이지 확인 실패:`, parentError)
          }
          
          const serialPage = await client.pages.create({
            parent: { page_id: workPageId },
            properties: {
              title: {
                title: [{ text: { content: '연재' } }],
              },
            },
          })
          return serialPage.id
        } catch (error: any) {
          if (error?.message?.includes('archived')) {
            // 부모가 아카이브되어 있으면 복구 후 재시도
            try {
              await client.pages.update({
                page_id: workPageId,
                archived: false,
              })
              const serialPage = await client.pages.create({
                parent: { page_id: workPageId },
                properties: {
                  title: {
                    title: [{ text: { content: '연재' } }],
                  },
                },
              })
              return serialPage.id
            } catch (retryError) {
              throw retryError
            }
          }
          throw error
        }
      }
      
      if (!serialPageId) {
        try {
          serialPageId = await createSerialPage()
          serialPageMap.set(work.id, serialPageId)
          console.log(`작품 "${work.title}"의 연재 페이지 생성 완료`)
        } catch (error) {
          console.error(`작품 "${work.title}"의 연재 페이지 생성 실패:`, error)
        }
      } else {
        // 기존 연재 페이지가 아카이브되어 있는지 확인
        try {
          const existingSerialPage = await client.pages.retrieve({ page_id: serialPageId })
          if ((existingSerialPage as any).archived) {
            console.warn(`작품 "${work.title}"의 연재 페이지가 아카이브되어 있습니다. 새로 생성합니다.`)
            try {
              serialPageId = await createSerialPage()
        serialPageMap.set(work.id, serialPageId)
              console.log(`작품 "${work.title}"의 연재 페이지 재생성 완료`)
            } catch (createError) {
              console.error(`작품 "${work.title}"의 연재 페이지 재생성 실패:`, createError)
              serialPageId = undefined // 실패 시 undefined로 설정
            }
          } else {
            serialPageMap.set(work.id, serialPageId)
          }
        } catch (retrieveError: any) {
          // 페이지를 찾을 수 없는 경우 새로 생성
          if (retrieveError?.code === 'object_not_found' || retrieveError?.message?.includes('archived')) {
            console.warn(`작품 "${work.title}"의 연재 페이지를 찾을 수 없습니다. 새로 생성합니다.`)
            try {
              serialPageId = await createSerialPage()
              serialPageMap.set(work.id, serialPageId)
              console.log(`작품 "${work.title}"의 연재 페이지 재생성 완료`)
            } catch (createError) {
              console.error(`작품 "${work.title}"의 연재 페이지 재생성 실패:`, createError)
              serialPageId = undefined // 실패 시 undefined로 설정
            }
          } else {
            console.error(`작품 "${work.title}"의 연재 페이지 확인 실패:`, retrieveError)
            serialPageId = undefined // 실패 시 undefined로 설정
          }
        }
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

  // 변경된 장/회차가 있는 작품 ID 수집 (작품이 변경되지 않아도 연재 페이지 업데이트 필요)
  const worksWithChangedChaptersOrEpisodes = new Set<string>()
  data.chapters.forEach(c => worksWithChangedChaptersOrEpisodes.add(c.workId))
  data.episodes.forEach(e => worksWithChangedChaptersOrEpisodes.add(e.workId))

  // 2. 각 작품별로 하위 페이지 생성/업데이트 (작품이 변경된 경우)
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
            type: 'code',
            code: {
              language: 'json',
              rich_text: [
                {
                  type: 'text',
                  text: { content: JSON.stringify({
                    id: synopsis.id,
                    workId: synopsis.workId,
                    structure: synopsis.structure,
                    characterIds: synopsis.characterIds,
                    settingIds: synopsis.settingIds,
                    createdAt: synopsis.createdAt?.toISOString(),
                    updatedAt: synopsis.updatedAt?.toISOString(),
                    syncedAt: synopsis.syncedAt?.toISOString(),
                    isDirty: synopsis.isDirty,
                  }, null, 2) },
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
        updateNotionWorkPage(work.id, { workPageId, charactersPageId: charactersPageId })
      }
      
      // 각 캐릭터를 하위 페이지로 생성/업데이트 (병렬 처리)
      await processBatch(characters, 5, async (character) => {
        try {
          const existingCharacterPageId = characterPageIds[character.id]
          
          // 캐릭터 데이터를 JSON 블록으로 저장
          const characterBlocks: any[] = [
              {
                object: 'block',
              type: 'code',
              code: {
                language: 'json',
                  rich_text: [
                    {
                      type: 'text',
                    text: { content: JSON.stringify({
                      id: character.id,
                      workId: character.workId,
                      name: character.name,
                      description: character.description,
                      age: character.age,
                      role: character.role,
                      isMainCharacter: character.isMainCharacter,
                      order: character.order,
                      notes: character.notes,
                      synopsisIds: character.synopsisIds,
                      createdAt: character.createdAt?.toISOString(),
                      updatedAt: character.updatedAt?.toISOString(),
                      syncedAt: character.syncedAt?.toISOString(),
                      isDirty: character.isDirty,
                    }, null, 2) },
                    },
                  ],
                },
              },
          ]
          
          const characterPageId = await updateOrCreatePage(
            client,
            charactersPageId,
            existingCharacterPageId, // 기존 페이지 ID 사용
            character.name || '이름 없음',
            characterBlocks
          )
          // 새로 생성된 경우에만 ID 저장
          if (!existingCharacterPageId || characterPageId !== existingCharacterPageId) {
            characterPageIds[character.id] = characterPageId
          }
        } catch (error) {
          console.error(`캐릭터 "${character.name}" 페이지 동기화 실패:`, error)
        }
      })
      // 기존 characterPageIds와 병합하여 저장
      const finalCharacterPageIds = { ...characterPageIds }
      updateNotionWorkPage(work.id, { workPageId, characterPageIds: finalCharacterPageIds })
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
        updateNotionWorkPage(work.id, { workPageId, settingsPageId: settingsPageId })
      }
      
      // 각 설정을 하위 페이지로 생성/업데이트 (병렬 처리)
      await processBatch(settings, 5, async (setting) => {
        try {
          const existingSettingPageId = settingPageIds[setting.id]
          
          // 설정 데이터를 JSON 블록으로 저장
          const settingBlocks: any[] = [
              {
                object: 'block',
              type: 'code',
              code: {
                language: 'json',
                  rich_text: [
                    {
                      type: 'text',
                    text: { content: JSON.stringify({
                      id: setting.id,
                      workId: setting.workId,
                      name: setting.name,
                      description: setting.description,
                      type: setting.type,
                      order: setting.order,
                      notes: setting.notes,
                      synopsisIds: setting.synopsisIds,
                      createdAt: setting.createdAt?.toISOString(),
                      updatedAt: setting.updatedAt?.toISOString(),
                      syncedAt: setting.syncedAt?.toISOString(),
                      isDirty: setting.isDirty,
                    }, null, 2) },
                    },
                  ],
                },
              },
          ]
          
          const settingPageId = await updateOrCreatePage(
            client,
            settingsPageId,
            existingSettingPageId, // 기존 페이지 ID 사용
            setting.name || '이름 없음',
            settingBlocks
          )
          // 새로 생성된 경우에만 ID 저장
          if (!existingSettingPageId || settingPageId !== existingSettingPageId) {
            settingPageIds[setting.id] = settingPageId
          }
        } catch (error) {
          console.error(`설정 "${setting.name}" 페이지 동기화 실패:`, error)
        }
      })
      // 기존 settingPageIds와 병합하여 저장
      const finalSettingPageIds = { ...settingPageIds }
      updateNotionWorkPage(work.id, { workPageId, settingPageIds: finalSettingPageIds })
      console.log(`작품 "${work.title}"의 설정 페이지 동기화 완료 (${settings.length}개)`)
    } catch (error) {
      console.error(`작품 "${work.title}"의 설정 페이지 동기화 실패:`, error)
    }

    // 2-4. 연재 페이지 내부에 장과 회차 생성/업데이트
    const serialPageId = serialPageMap.get(work.id)
    if (serialPageId) {
      const chapters = data.chapters.filter(c => c.workId === work.id)
      
      // 장별로 그룹화하여 생성/업데이트 (기존 페이지 ID 유지)
      for (const chapter of chapters) {
        try {
          const existingChapterPageId = chapterPageIds[chapter.id]
          const chapterBlocks = [
            {
              object: 'block',
              type: 'code',
              code: {
                language: 'json',
                rich_text: [
                  {
                    type: 'text',
                    text: { content: JSON.stringify({
                      id: chapter.id,
                      workId: chapter.workId,
                      title: chapter.title,
                      structureType: chapter.structureType,
                      order: chapter.order,
                      createdAt: chapter.createdAt?.toISOString(),
                      updatedAt: chapter.updatedAt?.toISOString(),
                      syncedAt: chapter.syncedAt?.toISOString(),
                      isDirty: chapter.isDirty,
                    }, null, 2) },
                  },
                ],
              },
            },
          ]
          const chapterPageId = await updateOrCreatePage(
            client,
            serialPageId,
            existingChapterPageId, // 기존 페이지 ID 사용
            chapter.title,
            chapterBlocks
          )
          // 새로 생성된 경우에만 ID 저장
          if (!existingChapterPageId || chapterPageId !== existingChapterPageId) {
            chapterPageIds[chapter.id] = chapterPageId
          }
          chapterPageMap.set(chapter.id, chapterPageId)
          
          // 해당 장의 회차들 생성/업데이트 (병렬 처리)
          const episodes = data.episodes.filter(e => e.chapterId === chapter.id)
          await processBatch(episodes, 5, async (episode) => {
            try {
              const existingEpisodePageId = episodePageIds[episode.id]
              const episodeBlocks = episodeToNotionBlocks(episode)
              const episodePageId = await updateOrCreatePage(
                client,
                chapterPageId,
                existingEpisodePageId, // 기존 페이지 ID 사용
                `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
                episodeBlocks
              )
              // 새로 생성된 경우에만 ID 저장
              if (!existingEpisodePageId || episodePageId !== existingEpisodePageId) {
                episodePageIds[episode.id] = episodePageId
              }
            } catch (error) {
              console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
            }
          })
          console.log(`장 "${chapter.title}" 및 회차 ${episodes.length}개 동기화 완료`)
        } catch (error) {
          console.error(`장 "${chapter.title}" 페이지 동기화 실패:`, error)
        }
      }
      
      // 장이 없는 회차들도 생성/업데이트 (병렬 처리)
      const episodesWithoutChapter = data.episodes.filter(e => e.workId === work.id && !e.chapterId)
      await processBatch(episodesWithoutChapter, 5, async (episode) => {
        try {
          const existingEpisodePageId = episodePageIds[episode.id]
          const episodeBlocks = episodeToNotionBlocks(episode)
          const episodePageId = await updateOrCreatePage(
            client,
            serialPageId,
            existingEpisodePageId, // 기존 페이지 ID 사용
            `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
            episodeBlocks
          )
          // 새로 생성된 경우에만 ID 저장
          if (!existingEpisodePageId || episodePageId !== existingEpisodePageId) {
            episodePageIds[episode.id] = episodePageId
          }
        } catch (error) {
          console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
        }
      })
      
      // 기존 chapterPageIds와 episodePageIds와 병합하여 저장
      const finalChapterPageIds = { ...chapterPageIds }
      const finalEpisodePageIds = { ...episodePageIds }
      updateNotionWorkPage(work.id, {
        workPageId,
        chapterPageIds: finalChapterPageIds,
        episodePageIds: finalEpisodePageIds,
      })
    }
  }

  // 3. 변경된 장/회차가 있지만 작품이 변경되지 않은 경우, 연재 페이지 직접 업데이트
  console.log(`연재 페이지 동기화 시작: ${worksWithChangedChaptersOrEpisodes.size}개 작품`)
  for (const workId of worksWithChangedChaptersOrEpisodes) {
    // 작품이 이미 동기화되었으면 건너뛰기
    if (workPageMap.has(workId)) {
      console.log(`작품 ${workId}는 이미 동기화되었습니다.`)
      continue
    }
    
    const existingPageIds = existingPageMap[workId]
    if (!existingPageIds?.workPageId || !existingPageIds?.serialPageId) {
      console.warn(`작품 ${workId}의 연재 페이지를 찾을 수 없습니다. 작품을 먼저 동기화해야 합니다.`)
      continue
    }
    
    console.log(`작품 ${workId}의 연재 페이지 동기화 시작...`)
    
    let serialPageId = existingPageIds.serialPageId
    const workPageId = existingPageIds.workPageId
    const chapterPageIds: Record<string, string> = existingPageIds.chapterPageIds || {}
    const episodePageIds: Record<string, string> = existingPageIds.episodePageIds || {}
    
    // 연재 페이지 생성/확인 헬퍼 함수
    const ensureSerialPage = async () => {
      // 부모 페이지(작품 페이지)가 아카이브되어 있는지 확인 및 복구
      try {
        const parentPage = await client.pages.retrieve({ page_id: workPageId })
        if ((parentPage as any).archived) {
          console.warn(`작품 ${workId} 페이지가 아카이브되어 있습니다. 복구합니다.`)
          await client.pages.update({
            page_id: workPageId,
            archived: false,
          })
          console.log(`작품 ${workId} 페이지 복구 완료`)
        }
      } catch (parentError) {
        console.warn(`작품 ${workId} 페이지 확인 실패:`, parentError)
      }
      
      // 연재 페이지가 있는지 확인
      if (serialPageId) {
        try {
          const existingSerialPage = await client.pages.retrieve({ page_id: serialPageId })
          if ((existingSerialPage as any).archived) {
            console.warn(`작품 ${workId}의 연재 페이지가 아카이브되어 있습니다. 복구합니다.`)
            try {
              await client.pages.update({
                page_id: serialPageId,
                archived: false,
              })
              console.log(`작품 ${workId}의 연재 페이지 복구 완료`)
              return serialPageId
            } catch (unarchiveError) {
              console.warn(`작품 ${workId}의 연재 페이지 복구 실패, 새로 생성합니다:`, unarchiveError)
              // 복구 실패 시 새로 생성
            }
          } else {
            return serialPageId
          }
        } catch (retrieveError: any) {
          if (retrieveError?.code === 'object_not_found' || retrieveError?.message?.includes('archived')) {
            console.warn(`작품 ${workId}의 연재 페이지를 찾을 수 없습니다. 새로 생성합니다.`)
            // 페이지를 찾을 수 없으면 새로 생성
          } else {
            throw retrieveError
          }
        }
      }
      
      // 연재 페이지 새로 생성
      try {
        const serialPage = await client.pages.create({
          parent: { page_id: workPageId },
          properties: {
            title: {
              title: [{ text: { content: '연재' } }],
            },
          },
        })
        const newSerialPageId = serialPage.id
        // 새로 생성된 연재 페이지 ID 저장
        updateNotionWorkPage(workId, {
          workPageId,
          serialPageId: newSerialPageId,
        })
        console.log(`작품 ${workId}의 연재 페이지 생성 완료`)
        return newSerialPageId
      } catch (createError: any) {
        if (createError?.message?.includes('archived')) {
          // 부모가 아카이브되어 있으면 복구 후 재시도
          try {
            await client.pages.update({
              page_id: workPageId,
              archived: false,
            })
            const serialPage = await client.pages.create({
              parent: { page_id: workPageId },
              properties: {
                title: {
                  title: [{ text: { content: '연재' } }],
                },
              },
            })
            const newSerialPageId = serialPage.id
            updateNotionWorkPage(workId, {
              workPageId,
              serialPageId: newSerialPageId,
            })
            console.log(`작품 ${workId}의 연재 페이지 생성 완료 (부모 복구 후)`)
            return newSerialPageId
          } catch (retryError) {
            throw retryError
          }
        }
        throw createError
      }
    }
    
    try {
      // 연재 페이지 확인 및 생성/복구
      serialPageId = await ensureSerialPage()
      if (!serialPageId) {
        console.error(`작품 ${workId}의 연재 페이지를 생성할 수 없습니다.`)
        continue
      }
      
      const chapters = data.chapters.filter(c => c.workId === workId)
      
      // 장별로 그룹화하여 생성/업데이트
      for (const chapter of chapters) {
        try {
          const existingChapterPageId = chapterPageIds[chapter.id]
          const chapterBlocks = [
              {
                object: 'block',
              type: 'code',
              code: {
                language: 'json',
                  rich_text: [
                    {
                      type: 'text',
                    text: { content: JSON.stringify({
                      id: chapter.id,
                      workId: chapter.workId,
                      title: chapter.title,
                      structureType: chapter.structureType,
                      order: chapter.order,
                      createdAt: chapter.createdAt?.toISOString(),
                      updatedAt: chapter.updatedAt?.toISOString(),
                      syncedAt: chapter.syncedAt?.toISOString(),
                      isDirty: chapter.isDirty,
                    }, null, 2) },
                    },
                  ],
                },
              },
            ]
          const chapterPageId = await updateOrCreatePage(
            client,
            serialPageId,
            existingChapterPageId,
            chapter.title,
            chapterBlocks
          )
          if (!existingChapterPageId || chapterPageId !== existingChapterPageId) {
            chapterPageIds[chapter.id] = chapterPageId
          }
          
          // 해당 장의 회차들 생성/업데이트
          const episodes = data.episodes.filter(e => e.chapterId === chapter.id)
          await processBatch(episodes, 5, async (episode) => {
            try {
              const existingEpisodePageId = episodePageIds[episode.id]
              const episodeBlocks = episodeToNotionBlocks(episode)
              const episodePageId = await updateOrCreatePage(
                client,
                chapterPageId,
                existingEpisodePageId,
                `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
                episodeBlocks
              )
          if (!existingEpisodePageId || episodePageId !== existingEpisodePageId) {
            episodePageIds[episode.id] = episodePageId
          }
        } catch (error) {
          console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
            }
          })
        } catch (error) {
          console.error(`장 "${chapter.title}" 페이지 동기화 실패:`, error)
        }
      }
      
      // 장이 없는 회차들도 생성/업데이트
      const episodesWithoutChapter = data.episodes.filter(e => e.workId === workId && !e.chapterId)
      await processBatch(episodesWithoutChapter, 5, async (episode) => {
        try {
          const existingEpisodePageId = episodePageIds[episode.id]
          const episodeBlocks = episodeToNotionBlocks(episode)
          const episodePageId = await updateOrCreatePage(
            client,
            serialPageId,
            existingEpisodePageId,
            `제 ${episode.episodeNumber}화${episode.title ? ` - ${episode.title}` : ''}`,
            episodeBlocks
          )
          if (!existingEpisodePageId || episodePageId !== existingEpisodePageId) {
            episodePageIds[episode.id] = episodePageId
          }
        } catch (error) {
          console.error(`회차 ${episode.episodeNumber}화 페이지 동기화 실패:`, error)
        }
      })
      
      // 페이지 ID 매핑 저장
      updateNotionWorkPage(workId, {
        workPageId,
        chapterPageIds,
        episodePageIds,
      })
      
      // 연재 페이지에 통계 정보 추가
      try {
        const allEpisodes = data.episodes.filter(e => e.workId === workId)
        const totalEpisodes = allEpisodes.length
        const totalWordCount = allEpisodes.reduce((sum, e) => sum + (e.wordCount || 0), 0)
        const totalViewCount = allEpisodes.reduce((sum, e) => sum + (e.viewCount || 0), 0)
        const totalSubscriberCount = allEpisodes.length > 0 ? allEpisodes[0].subscriberCount || 0 : 0
        const totalChapters = chapters.length
        
        const statsBlocks: any[] = [
          {
            object: 'block',
            type: 'heading_1',
            heading_1: {
              rich_text: [{ type: 'text', text: { content: '연재 통계' } }],
            },
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: '총 장 수' } }],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: String(totalChapters) } }],
            },
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: '총 회차 수' } }],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: String(totalEpisodes) } }],
            },
          },
          {
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: '총 글자 수' } }],
            },
          },
          {
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: totalWordCount.toLocaleString() } }],
            },
          },
        ]
        
        if (totalViewCount > 0) {
          statsBlocks.push({
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: '총 조회수' } }],
            },
          })
          statsBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: totalViewCount.toLocaleString() } }],
            },
          })
        }
        
        if (totalSubscriberCount > 0) {
          statsBlocks.push({
            object: 'block',
            type: 'heading_2',
            heading_2: {
              rich_text: [{ type: 'text', text: { content: '선작수' } }],
            },
          })
          statsBlocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', text: { content: totalSubscriberCount.toLocaleString() } }],
            },
          })
        }
        
        // 기존 블록 확인 및 통계 정보 업데이트
        try {
          const existingBlocks = await client.blocks.children.list({ block_id: serialPageId })
          const activeBlocks = existingBlocks.results.filter((b: any) => !b.archived)
          
          // 통계 섹션이 있는지 확인
          const statsIndex = activeBlocks.findIndex((b: any) => 
            b.type === 'heading_1' && 
            b.heading_1?.rich_text?.[0]?.text?.content === '연재 통계'
          )
          
          if (statsIndex !== -1) {
            // 통계 섹션이 있으면 해당 섹션부터 끝까지 삭제
            const blocksToDelete = activeBlocks.slice(statsIndex)
            for (const block of blocksToDelete) {
              try {
                await client.blocks.delete({ block_id: block.id })
              } catch (e) {
                // 삭제 실패는 무시
              }
            }
          }
          
          // 새 통계 정보 추가
          if (statsBlocks.length > 0) {
            await client.blocks.children.append({
              block_id: serialPageId,
              children: statsBlocks,
            })
          }
        } catch (blockError) {
          console.warn('블록 확인 실패, 통계 정보 추가 시도:', blockError)
          if (statsBlocks.length > 0) {
            await client.blocks.children.append({
              block_id: serialPageId,
              children: statsBlocks,
            })
          }
        }
        
        console.log(`작품 ${workId}의 연재 통계 정보 동기화 완료`)
      } catch (error) {
        console.error(`작품 ${workId}의 연재 통계 정보 동기화 실패:`, error)
      }
      
      console.log(`작품 ${workId}의 연재 페이지 동기화 완료 (작품 변경 없이)`)
    } catch (error) {
      console.error(`작품 ${workId}의 연재 페이지 동기화 실패:`, error)
    }
  }

  // 7. Tag Categories 및 Tags 동기화
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
      map.__tags_page__ = { workPageId: tagsPageId, tagCategoryPageIds: {}, tagPageIds: {} } as any
      setNotionWorkPageMap(map)
      console.log('태그 페이지 생성 완료')
    } catch (error: any) {
      console.error('태그 페이지 생성 실패:', error)
      if (error?.message?.includes('archived')) {
        console.error('부모 페이지가 아카이브되어 있어서 태그 페이지를 생성할 수 없습니다.')
      }
      // 태그 페이지 생성 실패해도 다른 동기화는 계속 진행
      tagsPageId = null
    }
  } else {
    // 기존 태그 페이지가 아카이브되어 있는지 확인
    try {
      const existingTagsPage = await client.pages.retrieve({ page_id: tagsPageId })
      if ((existingTagsPage as any).archived) {
        console.warn('태그 페이지가 아카이브되어 있습니다. 새로 생성합니다.')
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
        map.__tags_page__ = { workPageId: tagsPageId, tagCategoryPageIds: {}, tagPageIds: {} } as any
        setNotionWorkPageMap(map)
        console.log('태그 페이지 재생성 완료')
      }
    } catch (error) {
      console.warn('태그 페이지 확인 실패:', error)
    }
  }
  
  // 7-1. 태그 카테고리 동기화
  if (data.tagCategories.length > 0 && tagsPageId) {
    console.log(`태그 카테고리 ${data.tagCategories.length}개 동기화 시작...`)
    let tagCategorySuccessCount = 0
    
    // 태그 카테고리 페이지 ID 매핑 가져오기
    const tagsPageData = existingPageMap.__tags_page__
    const tagCategoryPageIds: Record<string, string> = (tagsPageData as any)?.tagCategoryPageIds || {}
    
    for (const category of data.tagCategories) {
      try {
        // 태그 카테고리를 태그 페이지의 하위 페이지로 생성/업데이트
        const existingCategoryPageId = tagCategoryPageIds[category.id]
        const categoryPageId = await updateOrCreatePage(
          client,
          tagsPageId,
          existingCategoryPageId, // 기존 페이지 ID 사용
          category.name || '이름 없음',
          [
            {
              object: 'block',
              type: 'code',
              code: {
                language: 'json' as any,
                rich_text: [
                  {
                    type: 'text',
                    text: { content: JSON.stringify({
                      id: category.id,
                      name: category.name,
                      order: category.order,
                      createdAt: category.createdAt?.toISOString(),
                      updatedAt: category.updatedAt?.toISOString(),
                    }, null, 2) },
                  },
                ],
              },
            },
          ]
        )
        // 새로 생성된 경우에만 ID 저장
        if (!existingCategoryPageId || categoryPageId !== existingCategoryPageId) {
          tagCategoryPageIds[category.id] = categoryPageId
        }
        tagCategorySuccessCount++
        console.log(`태그 카테고리 "${category.name}" 동기화 완료`)
      } catch (error) {
        console.error(`태그 카테고리 ${category.id} (${category.name}) 동기화 실패:`, error)
        if (error instanceof Error) {
          console.error('에러 메시지:', error.message)
        }
      }
    }
    
    // 태그 카테고리 페이지 ID 매핑 저장
    const map = getNotionWorkPageMap()
    if (!map.__tags_page__) {
      map.__tags_page__ = { workPageId: tagsPageId, tagCategoryPageIds: {}, tagPageIds: {} } as any
    }
    ;(map.__tags_page__ as any).workPageId = tagsPageId
    ;(map.__tags_page__ as any).tagCategoryPageIds = tagCategoryPageIds
    setNotionWorkPageMap(map)
    console.log(`태그 카테고리 동기화 완료: ${tagCategorySuccessCount}개 성공`)
  } else {
    console.log('동기화할 태그 카테고리가 없습니다.')
  }
  
  // 7-2. 태그 동기화 (각 태그를 해당 카테고리 페이지의 하위 페이지로 생성)
  if (data.tags.length > 0 && tagsPageId) {
    console.log(`태그 ${data.tags.length}개 동기화 시작...`)
    let tagSuccessCount = 0
    
    // 태그 페이지 ID 매핑 가져오기
    const tagsPageData = existingPageMap.__tags_page__
    const tagCategoryPageIds: Record<string, string> = (tagsPageData as any)?.tagCategoryPageIds || {}
    const tagPageIds: Record<string, string> = (tagsPageData as any)?.tagPageIds || {}
    
    // 카테고리별로 태그 그룹화
    const tagsByCategory = new Map<string, Tag[]>()
    for (const tag of data.tags) {
      if (!tagsByCategory.has(tag.categoryId)) {
        tagsByCategory.set(tag.categoryId, [])
      }
      tagsByCategory.get(tag.categoryId)!.push(tag)
    }
    
    for (const [categoryId, tags] of tagsByCategory) {
      const categoryPageId = tagCategoryPageIds[categoryId]
      if (!categoryPageId) {
        console.warn(`카테고리 ${categoryId}의 페이지 ID를 찾을 수 없습니다. 태그 동기화를 건너뜁니다.`)
        continue
      }
      
      for (const tag of tags) {
        try {
          // 태그를 해당 카테고리 페이지의 하위 페이지로 생성/업데이트
          const existingTagPageId = tagPageIds[tag.id]
          const tagPageId = await updateOrCreatePage(
            client,
            categoryPageId,
            existingTagPageId, // 기존 페이지 ID 사용
            tag.name || '이름 없음',
            [
              {
                object: 'block',
                type: 'code',
                code: {
                  language: 'json' as any,
                  rich_text: [
                    {
                      type: 'text',
                      text: { content: JSON.stringify({
                        id: tag.id,
                        categoryId: tag.categoryId,
                        name: tag.name,
                        order: tag.order,
                        isNew: tag.isNew,
                        createdAt: tag.createdAt?.toISOString(),
                        updatedAt: tag.updatedAt?.toISOString(),
                      }, null, 2) },
                    },
                  ],
                },
              },
            ]
          )
          // 새로 생성된 경우에만 ID 저장
          if (!existingTagPageId || tagPageId !== existingTagPageId) {
            tagPageIds[tag.id] = tagPageId
          }
          tagSuccessCount++
          console.log(`태그 "${tag.name}" 동기화 완료 (카테고리: ${categoryId})`)
        } catch (error) {
          console.error(`태그 ${tag.id} (${tag.name}) 동기화 실패:`, error)
          if (error instanceof Error) {
            console.error('에러 메시지:', error.message)
          }
        }
      }
    }
    
    // 태그 페이지 ID 매핑 저장
    const map = getNotionWorkPageMap()
    if (!map.__tags_page__) {
      map.__tags_page__ = { workPageId: tagsPageId, tagCategoryPageIds: {}, tagPageIds: {} } as any
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
  
  // 동기화된 ID 목록 반환
  return {
    works: data.works.map(w => w.id),
    synopses: data.synopses.map(s => s.id),
    characters: data.characters.map(c => c.id),
    settings: data.settings.map(s => s.id),
    episodes: data.episodes.map(e => e.id),
    chapters: data.chapters.map(c => c.id),
    tags: data.tags.map(t => t.id),
    tagCategories: data.tagCategories.map(tc => tc.id),
  }
}

// 노션 블록에서 JSON 데이터 추출
function extractJsonFromBlocks(blocks: any[]): any | null {
  // 먼저 JSON 코드 블록 찾기
  for (const block of blocks) {
    if (block.type === 'code') {
      const language = block.code?.language || ''
      if (language === 'json' || language.toLowerCase() === 'json') {
        try {
          const richText = block.code?.rich_text || []
          const jsonText = richText
            .map((t: any) => {
              if (typeof t === 'string') return t
              return t.plain_text || t.text?.content || t.text?.plain_text || ''
            })
            .join('')
          
          if (!jsonText || jsonText.trim().length === 0) {
            continue
          }
          
          return JSON.parse(jsonText)
        } catch (e) {
          console.warn('JSON 파싱 실패:', e)
        }
      }
    }
  }
  
  // JSON 코드 블록이 없으면 paragraph 블록에서 파싱 시도 (기존 형식 호환)
  const paragraphTexts: string[] = []
  for (const block of blocks) {
    if (block.type === 'paragraph' && block.paragraph?.rich_text) {
      const text = block.paragraph.rich_text
        .map((t: any) => t.plain_text || t.text?.content || '')
        .join('')
      paragraphTexts.push(text)
    }
  }
  
  // paragraph 형식 파싱: "카테고리: ...", "태그: ...", "생성일: ...", "수정일: ..."
  if (paragraphTexts.length >= 4) {
    try {
      const categoryMatch = paragraphTexts.find(t => t.startsWith('카테고리:'))?.match(/카테고리:\s*(.+)/)
      const tagsMatch = paragraphTexts.find(t => t.startsWith('태그:'))?.match(/태그:\s*(.+)/)
      const createdAtMatch = paragraphTexts.find(t => t.startsWith('생성일:'))?.match(/생성일:\s*(.+)/)
      const updatedAtMatch = paragraphTexts.find(t => t.startsWith('수정일:'))?.match(/수정일:\s*(.+)/)
      
      if (categoryMatch || tagsMatch) {
        return {
          category: categoryMatch?.[1]?.trim() || '',
          tags: tagsMatch?.[1]?.trim() === '없음' ? [] : tagsMatch?.[1]?.split(',').map((t: string) => t.trim()) || [],
          createdAt: createdAtMatch?.[1]?.trim() !== '없음' ? createdAtMatch?.[1] : undefined,
          updatedAt: updatedAtMatch?.[1]?.trim() !== '없음' ? updatedAtMatch?.[1] : undefined,
        }
      }
    } catch (e) {
      console.warn('Paragraph 형식 파싱 실패:', e)
    }
  }
  
  return null
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
  tagCategories: TagCategory[]
}> {
  const rootPageId = getRootPageId()
  if (!rootPageId) {
    throw new Error('Root page ID is required. Please connect to Notion first.')
  }

  const result = {
    works: [] as Work[],
    synopses: [] as Synopsis[],
    characters: [] as Character[],
    settings: [] as Setting[],
    episodes: [] as Episode[],
    chapters: [] as Chapter[],
    tags: [] as Tag[],
    tagCategories: [] as TagCategory[],
  }

  try {
    // 저장된 페이지 ID 매핑 사용 (더 확실함)
    const pageMap = getNotionWorkPageMap()
    const workPageIds = Object.keys(pageMap).filter(key => key !== '__tags_page__')
    
    console.log(`저장된 작품 페이지 ID: ${workPageIds.length}개`)
    
    // 저장된 페이지 ID가 없으면 search API 사용
    let workPages: any[] = []
    
    if (workPageIds.length > 0) {
      // 저장된 페이지 ID로 직접 가져오기
      for (const workId of workPageIds) {
        const pageInfo = pageMap[workId]
        if (pageInfo?.workPageId) {
          try {
            const workPage = await client.pages.retrieve({ page_id: pageInfo.workPageId })
            if (!(workPage as any).archived) {
              // 태그 페이지 제외
              const title = (workPage as any).properties?.title?.title?.[0]?.plain_text || 
                           (workPage as any).properties?.title?.title?.[0]?.text?.content || ''
              if (title !== '태그') {
                workPages.push({ id: pageInfo.workPageId, workId })
              }
            }
          } catch (e) {
            console.warn(`작품 페이지 ${pageInfo.workPageId} 가져오기 실패:`, e)
          }
        }
      }
    } else {
      // 저장된 매핑이 없으면 search API 사용
      console.log('저장된 페이지 매핑이 없어 search API 사용')
      const searchResponse = await client.search({
        filter: {
          property: 'object',
          value: 'page',
        },
      })
      
      // 루트 페이지를 부모로 하는 페이지들만 필터링 (태그 페이지 제외)
      workPages = searchResponse.results.filter((item: any) => {
        if (item.object !== 'page' || (item as any).archived) return false
        const parent = (item as any).parent
        if (parent?.type !== 'page_id' || parent?.page_id !== rootPageId) return false
        
        // 태그 페이지 제외 (제목이 "태그"인 페이지)
        const title = (item as any).properties?.title?.title?.[0]?.plain_text || 
                     (item as any).properties?.title?.title?.[0]?.text?.content || ''
        if (title === '태그') return false
        
        return true
      }).map((item: any) => ({ id: item.id }))
    }
    
    console.log(`가져올 작품 페이지: ${workPages.length}개`)

    // 태그 페이지 별도 처리
    let tagsPageId: string | null = null
    const tagsPageData = pageMap.__tags_page__
    if (tagsPageData?.workPageId) {
      try {
        const tagsPage = await client.pages.retrieve({ page_id: tagsPageData.workPageId })
        const tagsPageTitle = (tagsPage as any).properties?.title?.title?.[0]?.plain_text || 
                             (tagsPage as any).properties?.title?.title?.[0]?.text?.content || ''
        
        if (tagsPageTitle === '태그' && !(tagsPage as any).archived) {
          tagsPageId = tagsPageData.workPageId
        }
      } catch (error) {
        console.warn('태그 페이지 가져오기 실패:', error)
      }
    }
    
    // 저장된 매핑에 태그 페이지가 없으면 search API로 찾기
    if (!tagsPageId) {
      try {
        const searchResponse = await client.search({
          filter: {
            property: 'object',
            value: 'page',
          },
        })
        
        const tagsPage = searchResponse.results.find((item: any) => {
          if (item.object !== 'page' || (item as any).archived) return false
          const parent = (item as any).parent
          if (parent?.type !== 'page_id' || parent?.page_id !== rootPageId) return false
          const title = (item as any).properties?.title?.title?.[0]?.plain_text || 
                       (item as any).properties?.title?.title?.[0]?.text?.content || ''
          return title === '태그'
        })
        
        if (tagsPage) {
          tagsPageId = (tagsPage as any).id
          console.log(`태그 페이지를 search API로 찾음: ${tagsPageId}`)
        }
      } catch (error) {
        console.warn('태그 페이지 검색 실패:', error)
      }
    }
    
    // 태그 페이지 처리
    if (tagsPageId) {
      console.log(`태그 페이지 처리 중: ${tagsPageId}`)
      try {
        const tagsPageBlocks = await client.blocks.children.list({ block_id: tagsPageId })
        const tagCategoryPages = tagsPageBlocks.results.filter((item: any) => 
          item.type === 'child_page' && !item.archived
        )
        
        console.log(`태그 카테고리 페이지: ${tagCategoryPages.length}개`)
        
        for (const categoryPageItem of tagCategoryPages) {
          try {
            const categoryTitle = ((categoryPageItem as any).child_page?.title) || '제목 없음'
            
            // 태그 카테고리 페이지의 블록들 가져오기
            const categoryBlocks = await client.blocks.children.list({ block_id: categoryPageItem.id })
            const categoryData = extractJsonFromBlocks(categoryBlocks.results)
            
            // 태그 카테고리 생성 (IndexedDB와 동일한 형태)
            const categoryId = categoryData?.id || crypto.randomUUID()
            const tagCategory: TagCategory = categoryData && categoryData.id ? {
              id: categoryData.id,
              name: categoryData.name || categoryTitle,
              order: categoryData.order || 0,
              createdAt: categoryData.createdAt ? new Date(categoryData.createdAt) : new Date(),
              updatedAt: categoryData.updatedAt ? new Date(categoryData.updatedAt) : new Date(),
            } : {
              id: categoryId,
              name: categoryTitle,
              order: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            const finalCategoryId = tagCategory.id // 태그 카테고리의 실제 ID 사용
            console.log(`태그 카테고리 저장: id=${finalCategoryId}, name=${tagCategory.name}`)
            result.tagCategories.push(tagCategory)
            
            // 태그 카테고리의 하위 페이지들 (태그들)
            const tagPages = categoryBlocks.results.filter((item: any) => 
              item.type === 'child_page' && !item.archived
            )
            
            for (const tagPageItem of tagPages) {
              try {
                const tagBlocks = await client.blocks.children.list({ block_id: tagPageItem.id })
                const tagData = extractJsonFromBlocks(tagBlocks.results)
                const tagTitle = ((tagPageItem as any).child_page?.title) || '이름 없음'
                
                // 태그 생성 (IndexedDB와 동일한 형태) - categoryId는 항상 태그 카테고리의 실제 ID 사용
                const tag: Tag = tagData && tagData.id ? {
                  id: tagData.id,
                  categoryId: finalCategoryId, // 항상 태그 카테고리의 실제 ID 사용
                  name: tagData.name || tagTitle,
                  order: tagData.order || 0,
                  isNew: tagData.isNew,
                  createdAt: tagData.createdAt ? new Date(tagData.createdAt) : new Date(),
                  updatedAt: tagData.updatedAt ? new Date(tagData.updatedAt) : new Date(),
                } : {
                  id: crypto.randomUUID(),
                  categoryId: finalCategoryId, // 항상 태그 카테고리의 실제 ID 사용
                  name: tagTitle,
                  order: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                console.log(`태그 저장: id=${tag.id}, categoryId=${tag.categoryId}, 카테고리ID=${finalCategoryId}`)
                result.tags.push(tag)
              } catch (tagError) {
                console.error(`태그 "${tagPageItem.id}" 처리 실패:`, tagError)
                // 계속 진행
              }
            }
          } catch (categoryError) {
            console.error(`태그 카테고리 "${categoryPageItem.id}" 처리 실패:`, categoryError)
            // 계속 진행
          }
        }
      } catch (error) {
        console.error('태그 페이지 처리 실패:', error)
      }
    } else {
      console.log('태그 페이지를 찾을 수 없습니다.')
    }

    for (const workPageItem of workPages) {
      try {
        const workPageId = workPageItem.id || workPageItem.workPageId
        if (!workPageId) continue
        
        // 작품 페이지 정보 가져오기
        const workPage = await client.pages.retrieve({ page_id: workPageId })
        const workPageTitle = (workPage as any).properties?.title?.title?.[0]?.plain_text || 
                             (workPage as any).properties?.title?.title?.[0]?.text?.content || 
                             '제목 없음'

        // 태그 페이지는 이미 별도로 처리했으므로 건너뛰기
        if (workPageTitle === '태그') {
          console.log(`태그 페이지는 이미 처리되었으므로 건너뜁니다: ${workPageId}`)
          continue
        }

        console.log(`작품 페이지 처리 중: ${workPageTitle} (${workPageId})`)

        // 작품 페이지의 블록들 가져오기
        const workBlocks = await client.blocks.children.list({ block_id: workPageId })
        console.log(`작품 페이지 블록 수: ${workBlocks.results.length}개`)
        console.log('블록 타입들:', workBlocks.results.map((b: any) => b.type))
        
        const workData = extractJsonFromBlocks(workBlocks.results)

        // 작품 데이터 복원 (IndexedDB와 동일한 형태)
        if (workData && workData.id) {
          const work: Work = {
            id: workData.id,
            title: workData.title || workPageTitle,
            description: workData.description || '',
            category: workData.category || '',
            tags: workData.tags || [],
            createdAt: workData.createdAt ? new Date(workData.createdAt) : new Date(),
            updatedAt: workData.updatedAt ? new Date(workData.updatedAt) : new Date(),
            syncedAt: workData.syncedAt ? new Date(workData.syncedAt) : undefined,
            isDirty: workData.isDirty || false,
          }
          result.works.push(work)
        } else {
          // JSON이 없으면 제목만으로 작품 생성 (하위 데이터 처리를 위해)
          const work: Work = {
            id: crypto.randomUUID(),
            title: workPageTitle,
            description: '',
            category: '',
            tags: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          result.works.push(work)
        }
        
        const work = result.works[result.works.length - 1]

        // 하위 페이지들 가져오기 (blocks.children.list로 가져올 수 있음)
        const childPages = workBlocks.results.filter((item: any) => 
          item.type === 'child_page' && !item.archived
        )
        
        console.log(`작품 "${work.title}"의 하위 페이지: ${childPages.length}개`)

        for (const childPageItem of childPages) {
            const childPageTitle = ((childPageItem as any).child_page?.title) || '제목 없음'
            
            // 시놉시스 페이지
            if (childPageTitle === '시놉시스') {
              const synopsisBlocks = await client.blocks.children.list({ block_id: childPageItem.id })
              console.log(`시놉시스 페이지 블록 수: ${synopsisBlocks.results.length}개, 타입:`, synopsisBlocks.results.map((b: any) => b.type))
              const synopsisData = extractJsonFromBlocks(synopsisBlocks.results)
              console.log(`시놉시스 데이터 파싱 결과:`, synopsisData ? '성공' : '실패')
              
              // 시놉시스 생성 (IndexedDB와 동일한 형태) - workId는 항상 현재 작품 ID로 설정
              const synopsis: Synopsis = synopsisData && synopsisData.id ? {
                ...synopsisData,
                workId: work.id, // 항상 현재 작품 ID 사용
                createdAt: synopsisData.createdAt ? new Date(synopsisData.createdAt) : new Date(),
                updatedAt: synopsisData.updatedAt ? new Date(synopsisData.updatedAt) : new Date(),
                syncedAt: synopsisData.syncedAt ? new Date(synopsisData.syncedAt) : undefined,
              } as Synopsis : {
                id: crypto.randomUUID(),
                workId: work.id,
                structure: { gi: [], seung: [], jeon: [], gyeol: [] },
                characterIds: [],
                settingIds: [],
                createdAt: new Date(),
                updatedAt: new Date(),
              }
              console.log(`시놉시스 저장: id=${synopsis.id}, workId=${synopsis.workId}, work.id=${work.id}`)
              result.synopses.push(synopsis)
            }
            // 캐릭터 페이지
            else if (childPageTitle === '캐릭터') {
              const characterPageBlocks = await client.blocks.children.list({ block_id: childPageItem.id })
              const characterPages = characterPageBlocks.results.filter((item: any) => 
                item.type === 'child_page' && !item.archived
              )

              for (const charPageItem of characterPages) {
                const charBlocks = await client.blocks.children.list({ block_id: charPageItem.id })
                const charData = extractJsonFromBlocks(charBlocks.results)
                const charTitle = ((charPageItem as any).child_page?.title) || '이름 없음'
                console.log(`캐릭터 "${charTitle}" 데이터 파싱 결과:`, charData ? '성공' : '실패')
                
                // 캐릭터 생성 (IndexedDB와 동일한 형태) - workId는 항상 현재 작품 ID로 설정
                const character: Character = charData && charData.id ? {
                  ...charData,
                  workId: work.id, // 항상 현재 작품 ID 사용
                  createdAt: charData.createdAt ? new Date(charData.createdAt) : new Date(),
                  updatedAt: charData.updatedAt ? new Date(charData.updatedAt) : new Date(),
                  syncedAt: charData.syncedAt ? new Date(charData.syncedAt) : undefined,
                } as Character : {
                  id: crypto.randomUUID(),
                  workId: work.id,
                  name: charTitle,
                  description: '',
                  order: 0,
                  notes: '',
                  synopsisIds: [],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                console.log(`캐릭터 저장: id=${character.id}, workId=${character.workId}, work.id=${work.id}`)
                result.characters.push(character)
              }
            }
            // 설정 페이지
            else if (childPageTitle === '설정') {
              const settingPageBlocks = await client.blocks.children.list({ block_id: childPageItem.id })
              const settingPages = settingPageBlocks.results.filter((item: any) => 
                item.type === 'child_page' && !item.archived
              )

              for (const settingPageItem of settingPages) {
                const settingBlocks = await client.blocks.children.list({ block_id: settingPageItem.id })
                const settingData = extractJsonFromBlocks(settingBlocks.results)
                const settingTitle = ((settingPageItem as any).child_page?.title) || '이름 없음'
                
                // 설정 생성 (IndexedDB와 동일한 형태) - workId는 항상 현재 작품 ID로 설정
                const setting: Setting = settingData && settingData.id ? {
                  ...settingData,
                  workId: work.id, // 항상 현재 작품 ID 사용
                  createdAt: settingData.createdAt ? new Date(settingData.createdAt) : new Date(),
                  updatedAt: settingData.updatedAt ? new Date(settingData.updatedAt) : new Date(),
                  syncedAt: settingData.syncedAt ? new Date(settingData.syncedAt) : undefined,
                } as Setting : {
                  id: crypto.randomUUID(),
                  workId: work.id,
                  name: settingTitle,
                  description: '',
                  type: 'other',
                  order: 0,
                  notes: '',
                  synopsisIds: [],
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                console.log(`설정 저장: id=${setting.id}, workId=${setting.workId}, work.id=${work.id}`)
                result.settings.push(setting)
              }
            }
            // 연재 페이지
            else if (childPageTitle === '연재') {
              const serialPageBlocks = await client.blocks.children.list({ block_id: childPageItem.id })
              const chapterPages = serialPageBlocks.results.filter((item: any) => 
                item.type === 'child_page' && !item.archived
              )

              for (const chapterPageItem of chapterPages) {
                const chapterTitle = ((chapterPageItem as any).child_page?.title) || '제목 없음'
                
                // 장 페이지의 블록들 가져오기
                const chapterBlocks = await client.blocks.children.list({ block_id: chapterPageItem.id })
                const chapterData = extractJsonFromBlocks(chapterBlocks.results)
                
                // 장 데이터 (IndexedDB와 동일한 형태) - workId는 항상 현재 작품 ID로 설정
                const chapter: Chapter = chapterData && chapterData.id ? {
                  ...chapterData,
                  workId: work.id, // 항상 현재 작품 ID 사용
                  createdAt: chapterData.createdAt ? new Date(chapterData.createdAt) : new Date(),
                  updatedAt: chapterData.updatedAt ? new Date(chapterData.updatedAt) : new Date(),
                  syncedAt: chapterData.syncedAt ? new Date(chapterData.syncedAt) : undefined,
                } as Chapter : {
                  id: crypto.randomUUID(),
                  workId: work.id,
                  title: chapterTitle,
                  order: 0,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }
                console.log(`장 저장: id=${chapter.id}, workId=${chapter.workId}, work.id=${work.id}`)
                result.chapters.push(chapter)

                // 장의 하위 페이지들 (회차들)
                const chapterPageBlocks = await client.blocks.children.list({ block_id: chapterPageItem.id })
                const episodePages = chapterPageBlocks.results.filter((item: any) => 
                  item.type === 'child_page' && !item.archived
                )

                for (const episodePageItem of episodePages) {
                  const episodeBlocks = await client.blocks.children.list({ block_id: episodePageItem.id })
                  const episodeData = extractJsonFromBlocks(episodeBlocks.results)
                  const episodeTitle = ((episodePageItem as any).child_page?.title) || '제목 없음'
                  
                  // 회차 생성 (IndexedDB와 동일한 형태) - workId와 chapterId는 항상 현재 값으로 설정
                  const episode: Episode = episodeData && episodeData.id ? {
                    ...episodeData,
                    workId: work.id, // 항상 현재 작품 ID 사용
                    chapterId: chapter.id, // 항상 현재 장 ID 사용
                    publishedAt: episodeData.publishedAt ? new Date(episodeData.publishedAt) : undefined,
                    createdAt: episodeData.createdAt ? new Date(episodeData.createdAt) : new Date(),
                    updatedAt: episodeData.updatedAt ? new Date(episodeData.updatedAt) : new Date(),
                    syncedAt: episodeData.syncedAt ? new Date(episodeData.syncedAt) : undefined,
                  } as Episode : {
                    id: crypto.randomUUID(),
                    workId: work.id,
                    chapterId: chapter.id,
                    episodeNumber: 0,
                    title: episodeTitle,
                    content: '',
                    wordCount: 0,
                    order: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }
                  console.log(`회차 저장: id=${episode.id}, workId=${episode.workId}, chapterId=${episode.chapterId}, work.id=${work.id}`)
                  result.episodes.push(episode)
                }

                // 장이 없는 회차들 (연재 페이지 직접 하위)
                const episodesWithoutChapter = serialPageBlocks.results.filter((item: any) => 
                  item.type === 'child_page' && 
                  !item.archived &&
                  ((item as any).child_page?.title?.startsWith('제 ')) &&
                  ((item as any).child_page?.title?.includes('화'))
                )

                for (const episodePageItem of episodesWithoutChapter) {
                  const episodeBlocks = await client.blocks.children.list({ block_id: episodePageItem.id })
                  const episodeData = extractJsonFromBlocks(episodeBlocks.results)
                  const episodeTitle = ((episodePageItem as any).child_page?.title) || '제목 없음'
                  
                  // 회차 생성 (IndexedDB와 동일한 형태) - workId는 항상 현재 작품 ID로 설정
                  const episode: Episode = episodeData && episodeData.id ? {
                    ...episodeData,
                    workId: work.id, // 항상 현재 작품 ID 사용
                    publishedAt: episodeData.publishedAt ? new Date(episodeData.publishedAt) : undefined,
                    createdAt: episodeData.createdAt ? new Date(episodeData.createdAt) : new Date(),
                    updatedAt: episodeData.updatedAt ? new Date(episodeData.updatedAt) : new Date(),
                    syncedAt: episodeData.syncedAt ? new Date(episodeData.syncedAt) : undefined,
                  } as Episode : {
                    id: crypto.randomUUID(),
                    workId: work.id,
                    episodeNumber: 0,
                    title: episodeTitle,
                    content: '',
                    wordCount: 0,
                    order: 0,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  }
                  console.log(`회차(장 없음) 저장: id=${episode.id}, workId=${episode.workId}, work.id=${work.id}`)
                  result.episodes.push(episode)
                }
              }
            }
          }
      } catch (error) {
        console.error(`작품 페이지 ${workPageItem.id} 처리 실패:`, error)
      }
    }
  } catch (error) {
    console.error('노션에서 데이터 가져오기 실패:', error)
    throw error
  }

  return result
}

