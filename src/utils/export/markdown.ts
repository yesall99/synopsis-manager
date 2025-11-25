import type { Synopsis } from '@/types'

export function synopsisToMarkdown(synopsis: Synopsis, workTitle?: string): string {
  const title = workTitle || '시놉시스'
  let markdown = `# ${title}\n\n`

  markdown += `**작성일:** ${new Date(synopsis.createdAt).toLocaleDateString('ko-KR')}\n`
  markdown += `**수정일:** ${new Date(synopsis.updatedAt).toLocaleDateString('ko-KR')}\n\n`

  markdown += '---\n\n'

  // 구조가 있으면 구조로 내보내기
  if (synopsis.structure) {
    const { gi, seung, jeon, gyeol } = synopsis.structure

    if (gi.length > 0) {
      markdown += `## 기\n\n`
      gi.forEach((section, index) => {
        markdown += `### ${section.title}\n\n`
        markdown += htmlToMarkdown(section.content)
        markdown += '\n\n'
      })
    }

    if (seung.length > 0) {
      markdown += `## 승\n\n`
      seung.forEach((section, index) => {
        markdown += `### ${section.title}\n\n`
        markdown += htmlToMarkdown(section.content)
        markdown += '\n\n'
      })
    }

    if (jeon.length > 0) {
      markdown += `## 전\n\n`
      jeon.forEach((section, index) => {
        markdown += `### ${section.title}\n\n`
        markdown += htmlToMarkdown(section.content)
        markdown += '\n\n'
      })
    }

    if (gyeol.length > 0) {
      markdown += `## 결\n\n`
      gyeol.forEach((section, index) => {
        markdown += `### ${section.title}\n\n`
        markdown += htmlToMarkdown(section.content)
        markdown += '\n\n'
      })
    }
  } else {
    // 기존 방식: HTML을 간단한 마크다운으로 변환
    // @ts-ignore - Old code
    const content = htmlToMarkdown((synopsis as any).content || '')
    markdown += content
  }

  return markdown
}

export function htmlToMarkdown(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  // 간단한 변환 (더 정교한 변환이 필요하면 라이브러리 사용)
  let markdown = div.textContent || div.innerText || ''

  // 제목 변환 (h1, h2 등)
  const headings = div.querySelectorAll('h1, h2, h3, h4, h5, h6')
  headings.forEach((heading) => {
    const level = parseInt(heading.tagName.charAt(1))
    const prefix = '#'.repeat(level) + ' '
    heading.textContent = prefix + (heading.textContent || '')
  })

  // 리스트 변환
  const lists = div.querySelectorAll('ul, ol')
  lists.forEach((list) => {
    const items = list.querySelectorAll('li')
    items.forEach((item, index) => {
      const prefix = list.tagName === 'UL' ? '- ' : `${index + 1}. `
      item.textContent = prefix + (item.textContent || '')
    })
  })

  return div.textContent || div.innerText || markdown
}

export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

