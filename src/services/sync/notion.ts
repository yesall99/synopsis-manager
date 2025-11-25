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

// 노션 데이터베이스 생성
export async function createNotionDatabase(
  client: Client,
  parentPageId: string,
  title: string,
  properties: any
): Promise<string> {
  try {
    const response = await client.databases.create({
      parent: {
        type: 'page_id',
        page_id: parentPageId,
      },
      title: [
        {
          type: 'text',
          text: {
            content: title,
          },
        },
      ],
      // @ts-ignore - Notion API types may not match exactly
      properties: properties,
    })
    return response.id
  } catch (error) {
    console.error('노션 데이터베이스 생성 실패:', error)
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

// 초기 데이터베이스 설정
export async function initializeNotionDatabases(client: Client, rootPageId: string): Promise<NotionDatabaseIds> {
  // 페이지 접근 권한 확인
  const hasAccess = await verifyRootPage(client, rootPageId)
  if (!hasAccess) {
    throw new Error('노션 페이지에 접근할 수 없습니다. 통합이 해당 페이지에 연결되어 있는지 확인해주세요.')
  }

  const dbIds: NotionDatabaseIds = {}

  // 1단계: 모든 데이터베이스 생성 (Relation 속성 없이)
  
  // Works 데이터베이스
  dbIds.works = await createNotionDatabase(client, rootPageId, '작품', {
    '제목': { title: {} },
    '카테고리': { rich_text: {} },
    '태그': { multi_select: { options: [] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Synopses 데이터베이스
  dbIds.synopses = await createNotionDatabase(client, rootPageId, '시놉시스', {
    '작품': { relation: { database_id: dbIds.works } },
    '구조': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Characters 데이터베이스
  dbIds.characters = await createNotionDatabase(client, rootPageId, '캐릭터', {
    '이름': { title: {} },
    '작품': { relation: { database_id: dbIds.works } },
    '역할': { rich_text: {} },
    '주연 여부': { checkbox: {} },
    '설명': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Settings 데이터베이스
  dbIds.settings = await createNotionDatabase(client, rootPageId, '설정', {
    '이름': { title: {} },
    '작품': { relation: { database_id: dbIds.works } },
    '유형': { select: { options: [
      { name: '세계관', color: 'blue' },
      { name: '장소', color: 'green' },
      { name: '시간', color: 'orange' },
      { name: '기타', color: 'gray' },
    ] } },
    '설명': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Chapters 데이터베이스
  dbIds.chapters = await createNotionDatabase(client, rootPageId, '장', {
    '제목': { title: {} },
    '작품': { relation: { database_id: dbIds.works } },
    '구조 구분': { select: { options: [
      { name: '기', color: 'blue' },
      { name: '승', color: 'green' },
      { name: '전', color: 'orange' },
      { name: '결', color: 'red' },
    ] } },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Episodes 데이터베이스
  dbIds.episodes = await createNotionDatabase(client, rootPageId, '회차', {
    '회차 번호': { number: {} },
    '제목': { title: {} },
    '작품': { relation: { database_id: dbIds.works } },
    '장': { relation: { database_id: dbIds.chapters } },
    '내용': { rich_text: {} },
    '글자수': { number: {} },
    '글자수(공백제외)': { number: {} },
    '선작수': { number: {} },
    '조회수': { number: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // Tags 데이터베이스 (태그는 작품과 직접 연결하지 않음)
  dbIds.tags = await createNotionDatabase(client, rootPageId, '태그', {
    '이름': { title: {} },
    '카테고리': { rich_text: {} },
    '생성일': { date: {} },
    '수정일': { date: {} },
  })

  // 2단계: Works 데이터베이스에 역관계 속성 추가 (양방향 관계)
  try {
    await client.databases.update({
      database_id: dbIds.works,
      properties: {
        '시놉시스': { 
          relation: { 
            database_id: dbIds.synopses,
            type: 'dual_property',
            // @ts-ignore - Notion API types
            dual_property: { synced_property_name: '작품' }
          } 
        },
        '캐릭터': { 
          relation: { 
            database_id: dbIds.characters,
            type: 'dual_property',
            // @ts-ignore
            dual_property: { synced_property_name: '작품' }
          } 
        },
        '설정': { 
          relation: { 
            database_id: dbIds.settings,
            type: 'dual_property',
            // @ts-ignore
            dual_property: { synced_property_name: '작품' }
          } 
        },
        '장': { 
          relation: { 
            database_id: dbIds.chapters,
            type: 'dual_property',
            // @ts-ignore
            dual_property: { synced_property_name: '작품' }
          } 
        },
        '회차': { 
          relation: { 
            database_id: dbIds.episodes,
            type: 'dual_property',
            // @ts-ignore
            dual_property: { synced_property_name: '작품' }
          } 
        },
      },
    })
  } catch (error) {
    console.warn('Works 데이터베이스 역관계 속성 추가 실패 (이미 존재할 수 있음):', error)
  }

  // Chapters 데이터베이스에 회차 역관계 추가
  try {
    await client.databases.update({
      database_id: dbIds.chapters,
      properties: {
        '회차': { 
          relation: { 
            database_id: dbIds.episodes,
            type: 'dual_property',
            // @ts-ignore
            dual_property: { synced_property_name: '장' }
          } 
        },
      },
    })
  } catch (error) {
    console.warn('Chapters 데이터베이스 역관계 속성 추가 실패:', error)
  }

  setNotionDatabaseIds(dbIds)
  return dbIds
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
  const dbIds = getNotionDatabaseIds()

  // 데이터베이스가 없으면 초기화
  if (!dbIds.works) {
    const rootPageId = getRootPageId()
    if (!rootPageId) {
      throw new Error('Root page ID is required. Please connect to Notion first.')
    }
    await initializeNotionDatabases(client, rootPageId)
    const newDbIds = getNotionDatabaseIds()
    Object.assign(dbIds, newDbIds)
  }

  // 작품별로 페이지 ID 매핑 저장
  const workPageMap = new Map<string, string>()
  const chapterPageMap = new Map<string, string>()

  // 1. Works 동기화
  if (dbIds.works) {
    for (const work of data.works) {
      try {
        const workPage = await client.pages.create({
          parent: { database_id: dbIds.works },
          properties: workToNotionProperties(work),
        })
        workPageMap.set(work.id, workPage.id)
      } catch (error) {
        console.error(`작품 ${work.id} 동기화 실패:`, error)
      }
    }
  }

  // 2. Chapters 동기화 (작품에 연결)
  if (dbIds.chapters) {
    for (const chapter of data.chapters) {
      const workPageId = workPageMap.get(chapter.workId)
      if (!workPageId) continue
      
      try {
        const chapterPage = await client.pages.create({
          parent: { database_id: dbIds.chapters },
          properties: chapterToNotionProperties(chapter, workPageId),
        })
        chapterPageMap.set(chapter.id, chapterPage.id)
      } catch (error) {
        console.error(`장 ${chapter.id} 동기화 실패:`, error)
      }
    }
  }

  // 3. Synopses 동기화 (작품에 연결)
  if (dbIds.synopses) {
    for (const synopsis of data.synopses) {
      const workPageId = workPageMap.get(synopsis.workId)
      if (!workPageId) continue
      
      try {
        await client.pages.create({
          parent: { database_id: dbIds.synopses },
          properties: synopsisToNotionProperties(synopsis, workPageId),
        })
      } catch (error) {
        console.error(`시놉시스 ${synopsis.id} 동기화 실패:`, error)
      }
    }
  }

  // 4. Characters 동기화 (작품에 연결)
  if (dbIds.characters) {
    for (const character of data.characters) {
      const workPageId = workPageMap.get(character.workId)
      if (!workPageId) continue
      
      try {
        await client.pages.create({
          parent: { database_id: dbIds.characters },
          properties: characterToNotionProperties(character, workPageId),
        })
      } catch (error) {
        console.error(`캐릭터 ${character.id} 동기화 실패:`, error)
      }
    }
  }

  // 5. Settings 동기화 (작품에 연결)
  if (dbIds.settings) {
    for (const setting of data.settings) {
      const workPageId = workPageMap.get(setting.workId)
      if (!workPageId) continue
      
      try {
        await client.pages.create({
          parent: { database_id: dbIds.settings },
          properties: settingToNotionProperties(setting, workPageId),
        })
      } catch (error) {
        console.error(`설정 ${setting.id} 동기화 실패:`, error)
      }
    }
  }

  // 6. Episodes 동기화 (작품과 장에 연결)
  if (dbIds.episodes) {
    for (const episode of data.episodes) {
      const workPageId = workPageMap.get(episode.workId)
      if (!workPageId) continue
      
      const chapterPageId = episode.chapterId ? chapterPageMap.get(episode.chapterId) : undefined
      
      try {
        await client.pages.create({
          parent: { database_id: dbIds.episodes },
          properties: episodeToNotionProperties(episode, workPageId, chapterPageId),
        })
      } catch (error) {
        console.error(`회차 ${episode.id} 동기화 실패:`, error)
      }
    }
  }

  // 7. Tags 동기화 (태그는 작품과 직접 연결하지 않음)
  if (dbIds.tags) {
    for (const tag of data.tags) {
      try {
        await client.pages.create({
          parent: { database_id: dbIds.tags },
          properties: {
            '이름': {
              title: [{ text: { content: tag.name } }],
            },
            '카테고리': {
              rich_text: tag.categoryId ? [{ text: { content: tag.categoryId } }] : [],
            },
            '생성일': {
              date: tag.createdAt ? { start: tag.createdAt.toISOString() } : null,
            },
            '수정일': {
              date: tag.updatedAt ? { start: tag.updatedAt.toISOString() } : null,
            },
          },
        })
      } catch (error) {
        console.error(`태그 ${tag.id} 동기화 실패:`, error)
      }
    }
  }
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

