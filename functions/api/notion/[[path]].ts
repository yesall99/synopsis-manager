/**
 * Cloudflare Pages Functions를 사용한 노션 API 프록시
 * 
 * 이 함수는 클라이언트에서 노션 API를 호출할 때 CORS 문제를 해결하기 위한 프록시입니다.
 * 
 * 사용법:
 * - 클라이언트에서 `/api/notion/search`로 POST 요청을 보내면 노션 API의 `/v1/search`로 프록시됩니다.
 * - Authorization 헤더에 노션 API 키를 포함해야 합니다.
 */

export async function onRequest(context: {
  request: Request
  env: any
  params: { path?: string[] }
}): Promise<Response> {
  const { request, params } = context
  
  // CORS 헤더 설정
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Notion-Version',
  }

  // OPTIONS 요청 처리 (CORS preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    })
  }

  try {
    // 요청에서 Authorization 헤더 추출
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header is required' }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      )
    }

    // 노션 API 경로 구성
    const path = params.path ? params.path.join('/') : ''
    const notionApiUrl = `https://api.notion.com/v1/${path}`

    // 요청 본문 가져오기
    const body = request.method !== 'GET' && request.method !== 'HEAD' 
      ? await request.text() 
      : undefined

    // 노션 API로 요청 전달
    const response = await fetch(notionApiUrl, {
      method: request.method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Notion-Version': request.headers.get('Notion-Version') || '2022-06-28',
      },
      body: body,
    })

    // 응답 본문 가져오기
    const responseBody = await response.text()

    // 응답 반환 (CORS 헤더 포함)
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...corsHeaders,
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
      },
    })
  } catch (error) {
    console.error('Notion API proxy error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

