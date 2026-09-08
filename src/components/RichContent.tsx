import type { ReactNode } from 'react'
import { contentParts } from '../lib/contentImageTokens'
import { ContentImage } from './ContentImage'

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi
const TRAILING_URL_PUNCTUATION = /[),.;!?]$/

export function LinkedText({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let lastIndex = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const matchIndex = match.index ?? 0
    let label = match[0]
    let trailing = ''
    while (TRAILING_URL_PUNCTUATION.test(label)) {
      trailing = label.slice(-1) + trailing
      label = label.slice(0, -1)
    }
    parts.push(text.slice(lastIndex, matchIndex))
    parts.push(<a className="task-description-link" href={label.startsWith('www.') ? `https://${label}` : label} key={`${matchIndex}-${label}`} rel="noopener noreferrer" target="_blank">{label}</a>)
    if (trailing) parts.push(trailing)
    lastIndex = matchIndex + match[0].length
  }
  parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

export function RichContent({ text, fallback, eagerImages = false }: { text: string | null | undefined; fallback?: string; eagerImages?: boolean }) {
  if (!text) return fallback ? <div className="rich-content"><span>{fallback}</span></div> : null
  return <div className="rich-content">{contentParts(text).map((part, index) => part.type === 'image'
    ? <ContentImage eager={eagerImages} id={part.id} key={`${part.id}-${index}`} />
    : part.value && <span className="rich-content-text" key={index}><LinkedText text={part.value} /></span>)}</div>
}
