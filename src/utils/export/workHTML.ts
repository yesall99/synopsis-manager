import type { Work, Synopsis, Character, Setting, Tag } from '@/types'

export function workToHTML(
  work: Work,
  synopsis: Synopsis | null,
  characters: Character[],
  settings: Setting[],
  tags: Tag[]
): string {
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(work.title)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 {
      color: #1a202c;
      border-bottom: 3px solid #4299e1;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }
    h2 {
      color: #2d3748;
      border-bottom: 2px solid #cbd5e0;
      padding-bottom: 0.5rem;
      margin-top: 2rem;
      margin-bottom: 1rem;
    }
    h3 {
      color: #4a5568;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
    .metadata {
      background: #f7fafc;
      padding: 1rem;
      border-radius: 0.5rem;
      margin-bottom: 2rem;
      font-size: 0.9rem;
    }
    .metadata p {
      margin: 0.5rem 0;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .tag {
      background: #bee3f8;
      color: #2c5282;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.85rem;
    }
    .section {
      margin-bottom: 2rem;
    }
    .character, .setting {
      border-left: 3px solid #4299e1;
      padding-left: 1rem;
      margin-bottom: 1.5rem;
    }
    .divider {
      border-top: 1px solid #e2e8f0;
      margin: 2rem 0;
    }
    @media print {
      body {
        padding: 1rem;
      }
      .metadata {
        border: 1px solid #e2e8f0;
      }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(work.title)}</h1>
  
  <div class="metadata">
    ${work.description ? `<p>${escapeHtml(work.description)}</p>` : ''}
    <p><strong>작성일:</strong> ${new Date(work.createdAt).toLocaleDateString('ko-KR')}</p>
    <p><strong>수정일:</strong> ${new Date(work.updatedAt).toLocaleDateString('ko-KR')}</p>
    ${work.category ? `<p><strong>카테고리:</strong> ${escapeHtml(work.category)}</p>` : ''}
    ${
      work.tags && work.tags.length > 0
        ? `<p><strong>태그:</strong> <span class="tags">${work.tags
            .map((tagId) => tags.find((t) => t.id === tagId)?.name)
            .filter((name) => name)
            .map((name) => `<span class="tag">${escapeHtml(name)}</span>`)
            .join('')}</span></p>`
        : ''
    }
  </div>

  ${synopsis && synopsis.structure ? renderSynopsis(synopsis) : ''}

  ${characters.length > 0 ? renderCharacters(characters) : ''}

  ${settings.length > 0 ? renderSettings(settings) : ''}
</body>
</html>
  `.trim()

  return html
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function renderSynopsis(synopsis: Synopsis): string {
  let html = '<div class="section"><h2>시놉시스</h2>'
  const { gi, seung, jeon, gyeol } = synopsis.structure

  const renderSection = (label: string, sections: typeof gi) => {
    if (sections.length === 0) return ''
    let sectionHtml = `<h3>${label}</h3>\n`
    sections.forEach((section) => {
      if (section.title) {
        sectionHtml += `<h4>${escapeHtml(section.title)}</h4>\n`
      }
      if (section.content) {
        sectionHtml += `<div>${section.content}</div>\n`
      }
    })
    return sectionHtml
  }

  html += renderSection('기', gi)
  html += renderSection('승', seung)
  html += renderSection('전', jeon)
  html += renderSection('결', gyeol)
  html += '</div><div class="divider"></div>'

  return html
}

function renderCharacters(characters: Character[]): string {
  let html = '<div class="section"><h2>캐릭터</h2>'
  
  // 주연 캐릭터
  const mainCharacters = characters.filter((c) => c.isMainCharacter)
  if (mainCharacters.length > 0) {
    html += '<h3>주연</h3>'
    mainCharacters.forEach((character) => {
      html += '<div class="character">'
      html += `<h4>${escapeHtml(character.name)}</h4>`
      if (character.role) {
        html += `<p><strong>역할:</strong> ${escapeHtml(character.role)}</p>`
      }
      if (character.age) {
        html += `<p><strong>나이:</strong> ${character.age}세</p>`
      }
      if (character.description) {
        html += `<p>${escapeHtml(character.description)}</p>`
      }
      if (character.notes) {
        html += `<h5>노트</h5><div>${character.notes}</div>`
      }
      html += '</div>'
    })
  }

  // 조연 캐릭터
  const supportingCharacters = characters.filter((c) => !c.isMainCharacter)
  if (supportingCharacters.length > 0) {
    html += '<h3>조연</h3>'
    supportingCharacters.forEach((character) => {
      html += '<div class="character">'
      html += `<h4>${escapeHtml(character.name)}</h4>`
      if (character.role) {
        html += `<p><strong>역할:</strong> ${escapeHtml(character.role)}</p>`
      }
      if (character.age) {
        html += `<p><strong>나이:</strong> ${character.age}세</p>`
      }
      if (character.description) {
        html += `<p>${escapeHtml(character.description)}</p>`
      }
      if (character.notes) {
        html += `<h5>노트</h5><div>${character.notes}</div>`
      }
      html += '</div>'
    })
  }
  
  html += '</div><div class="divider"></div>'
  return html
}

function renderSettings(settings: Setting[]): string {
  let html = '<div class="section"><h2>설정</h2>'
  const typeLabels: Record<string, string> = {
    world: '세계관',
    location: '장소',
    time: '시간',
    other: '기타',
  }
  settings.forEach((setting) => {
    html += '<div class="setting">'
    html += `<h3>${escapeHtml(setting.name)}</h3>`
    html += `<p><strong>유형:</strong> ${typeLabels[setting.type] || setting.type}</p>`
    if (setting.description) {
      html += `<p>${escapeHtml(setting.description)}</p>`
    }
    if (setting.notes) {
      html += `<h4>노트</h4><div>${setting.notes}</div>`
    }
    html += '</div>'
  })
  html += '</div>'
  return html
}

export function downloadWorkHTML(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.html') ? filename : `${filename}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

