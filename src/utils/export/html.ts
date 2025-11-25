import type { Synopsis, SynopsisStructure } from '@/types'

export function synopsisToHTML(synopsis: Synopsis, workTitle?: string): string {
  const title = workTitle || '시놉시스'
  const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      max-width: 800px;
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
    .content {
      margin-top: 2rem;
    }
    .content h1, .content h2, .content h3 {
      margin-top: 2rem;
      margin-bottom: 1rem;
    }
    .content ul, .content ol {
      margin: 1rem 0;
      padding-left: 2rem;
    }
    .content p {
      margin: 1rem 0;
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
  <h1>${escapeHtml(title)}</h1>
  
  <div class="metadata">
    <p><strong>작성일:</strong> ${new Date(synopsis.createdAt).toLocaleDateString('ko-KR')}</p>
    <p><strong>수정일:</strong> ${new Date(synopsis.updatedAt).toLocaleDateString('ko-KR')}</p>
  </div>

  <div class="content">
    ${
      synopsis.structure
        ? renderStructure(synopsis.structure)
        : synopsis.content
    }
  </div>
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

function renderStructure(structure: SynopsisStructure): string {
  let html = ''

  const renderSection = (label: string, sections: typeof structure.gi) => {
    if (sections.length === 0) return ''
    let sectionHtml = `<h2>${label}</h2>\n`
    sections.forEach((section) => {
      sectionHtml += `<h3>${escapeHtml(section.title)}</h3>\n`
      sectionHtml += `<div>${section.content}</div>\n`
    })
    return sectionHtml
  }

  html += renderSection('기', structure.gi)
  html += renderSection('승', structure.seung)
  html += renderSection('전', structure.jeon)
  html += renderSection('결', structure.gyeol)

  return html
}

export function downloadHTML(content: string, filename: string): void {
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

