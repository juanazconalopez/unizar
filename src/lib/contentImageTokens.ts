const CONTENT_IMAGE_PATTERN = /\[\[imagen:([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\]\]/gi

export function contentImageToken(id: string) {
  return `[[imagen:${id}]]`
}

export function contentImageIds(text: string | null | undefined) {
  const ids: string[] = []
  for (const match of (text ?? '').matchAll(CONTENT_IMAGE_PATTERN)) {
    const id = match[1].toLowerCase()
    if (!ids.includes(id)) ids.push(id)
  }
  return ids
}

export function stripContentImageTokens(text: string | null | undefined) {
  return (text ?? '')
    .replace(CONTENT_IMAGE_PATTERN, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function removeContentImageToken(text: string, id: string) {
  return text
    .replaceAll(contentImageToken(id), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type ContentPart =
  | { type: 'text'; value: string }
  | { type: 'image'; id: string }

export function contentParts(text: string): ContentPart[] {
  const parts: ContentPart[] = []
  let lastIndex = 0
  for (const match of text.matchAll(CONTENT_IMAGE_PATTERN)) {
    const index = match.index ?? 0
    if (index > lastIndex) parts.push({ type: 'text', value: text.slice(lastIndex, index) })
    parts.push({ type: 'image', id: match[1].toLowerCase() })
    lastIndex = index + match[0].length
  }
  if (lastIndex < text.length) parts.push({ type: 'text', value: text.slice(lastIndex) })
  return parts
}

