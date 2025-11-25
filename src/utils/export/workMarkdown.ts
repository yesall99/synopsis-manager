import type { Work, Synopsis, Character, Setting, Tag } from '@/types'
import { htmlToMarkdown } from './markdown'

export function workToMarkdown(
  work: Work,
  synopsis: Synopsis | null,
  characters: Character[],
  settings: Setting[],
  tags: Tag[]
): string {
  let markdown = `# ${work.title}\n\n`

  // 작품 메타데이터
  if (work.description) {
    markdown += `${work.description}\n\n`
  }

  markdown += `**작성일:** ${new Date(work.createdAt).toLocaleDateString('ko-KR')}\n`
  markdown += `**수정일:** ${new Date(work.updatedAt).toLocaleDateString('ko-KR')}\n`

  if (work.category) {
    markdown += `**카테고리:** ${work.category}\n`
  }

  if (work.tags && work.tags.length > 0) {
    const tagNames = work.tags
      .map((tagId) => tags.find((t) => t.id === tagId)?.name)
      .filter((name) => name)
      .join(', ')
    if (tagNames) {
      markdown += `**태그:** ${tagNames}\n`
    }
  }

  markdown += '\n---\n\n'

  // 시놉시스
  if (synopsis && synopsis.structure) {
    markdown += `# 시놉시스\n\n`
    const { gi, seung, jeon, gyeol } = synopsis.structure

    if (gi.length > 0) {
      markdown += `## 기\n\n`
      gi.forEach((section) => {
        if (section.title) {
          markdown += `### ${section.title}\n\n`
        }
        if (section.content) {
          markdown += htmlToMarkdown(section.content)
          markdown += '\n\n'
        }
      })
    }

    if (seung.length > 0) {
      markdown += `## 승\n\n`
      seung.forEach((section) => {
        if (section.title) {
          markdown += `### ${section.title}\n\n`
        }
        if (section.content) {
          markdown += htmlToMarkdown(section.content)
          markdown += '\n\n'
        }
      })
    }

    if (jeon.length > 0) {
      markdown += `## 전\n\n`
      jeon.forEach((section) => {
        if (section.title) {
          markdown += `### ${section.title}\n\n`
        }
        if (section.content) {
          markdown += htmlToMarkdown(section.content)
          markdown += '\n\n'
        }
      })
    }

    if (gyeol.length > 0) {
      markdown += `## 결\n\n`
      gyeol.forEach((section) => {
        if (section.title) {
          markdown += `### ${section.title}\n\n`
        }
        if (section.content) {
          markdown += htmlToMarkdown(section.content)
          markdown += '\n\n'
        }
      })
    }

    markdown += '\n---\n\n'
  }

  // 캐릭터
  if (characters.length > 0) {
    markdown += `# 캐릭터\n\n`
    
    // 주연 캐릭터
    const mainCharacters = characters.filter((c) => c.isMainCharacter)
    if (mainCharacters.length > 0) {
      markdown += `## 주연\n\n`
      mainCharacters.forEach((character) => {
        markdown += `### ${character.name}\n\n`
        if (character.role) {
          markdown += `**역할:** ${character.role}\n`
        }
        if (character.age) {
          markdown += `**나이:** ${character.age}세\n`
        }
        if (character.description) {
          markdown += `\n${character.description}\n\n`
        }
        if (character.notes) {
          markdown += `#### 노트\n\n`
          markdown += htmlToMarkdown(character.notes)
          markdown += '\n\n'
        }
        markdown += '---\n\n'
      })
    }

    // 조연 캐릭터
    const supportingCharacters = characters.filter((c) => !c.isMainCharacter)
    if (supportingCharacters.length > 0) {
      markdown += `## 조연\n\n`
      supportingCharacters.forEach((character) => {
        markdown += `### ${character.name}\n\n`
        if (character.role) {
          markdown += `**역할:** ${character.role}\n`
        }
        if (character.age) {
          markdown += `**나이:** ${character.age}세\n`
        }
        if (character.description) {
          markdown += `\n${character.description}\n\n`
        }
        if (character.notes) {
          markdown += `#### 노트\n\n`
          markdown += htmlToMarkdown(character.notes)
          markdown += '\n\n'
        }
        markdown += '---\n\n'
      })
    }
  }

  // 설정
  if (settings.length > 0) {
    markdown += `# 설정\n\n`
    settings.forEach((setting) => {
      markdown += `## ${setting.name}\n\n`
      markdown += `**유형:** ${getSettingTypeLabel(setting.type)}\n`
      if (setting.description) {
        markdown += `\n${setting.description}\n\n`
      }
      if (setting.notes) {
        markdown += `### 노트\n\n`
        markdown += htmlToMarkdown(setting.notes)
        markdown += '\n\n'
      }
      markdown += '---\n\n'
    })
  }

  return markdown
}

function getSettingTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    world: '세계관',
    location: '장소',
    time: '시간',
    other: '기타',
  }
  return labels[type] || type
}

export function downloadWorkMarkdown(content: string, filename: string): void {
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

