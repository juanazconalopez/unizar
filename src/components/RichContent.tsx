import { Fragment, lazy, memo, Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { contentParts } from '../lib/contentImageTokens'
import { ContentImage } from './ContentImage'

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi
const TRAILING_URL_PUNCTUATION = /[),.;!?]$/
const FormattedContent = lazy(() => import('./FormattedContent'))
// Si hay sintaxis, HTML, entidades, enlaces o código indentado, conservar el
// parser completo y su saneado. El texto plano no necesita descargarlo.
const FORMATTED_TEXT = /[\\`*_~[\]<>#|&@]|https?:\/\/|www\.|^[ \t]*(?:[-+=]|\d+[.)](?:\s|$))|^(?: {4}|\t)/m

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

export const RichContent = memo(function RichContent({ text, fallback, eagerImages = false, renderImages = true, formatter: Formatter = FormattedContent }: { text: string | null | undefined; fallback?: string; eagerImages?: boolean; renderImages?: boolean; formatter?: ComponentType<{ text: string }> }) {
  if (!text) return fallback ? <div className="rich-content"><span>{fallback}</span></div> : null
  return <div className="rich-content">{contentParts(text).map((part, index) => part.type === 'image'
    ? renderImages
    ? <ContentImage eager={eagerImages} id={part.id} key={`${part.id}-${index}`} />
    : null
    : part.value && <div className="rich-content-text" key={index}>
      {FORMATTED_TEXT.test(part.value)
        ? <Suspense fallback={<span aria-label="Cargando contenido" role="status">Cargando contenido…</span>}><Formatter text={part.value} /></Suspense>
        : part.value.trim().split(/\r?\n[ \t]*\r?\n/).map((paragraph, paragraphIndex) => <Fragment key={paragraphIndex}>{paragraphIndex > 0 && '\n'}<p>{paragraph.split(/\r?\n/).map((line, lineIndex) => <Fragment key={lineIndex}>{lineIndex > 0 && <><br />{'\n'}</>}{line}</Fragment>)}</p></Fragment>)}
    </div>)}</div>
})
