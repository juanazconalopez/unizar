import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { contentParts } from '../lib/contentImageTokens'
import { ContentImage } from './ContentImage'

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+/gi
const TRAILING_URL_PUNCTUATION = /[),.;!?]$/
const MARKDOWN_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
}

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

export function RichContent({ text, fallback, eagerImages = false, renderImages = true }: { text: string | null | undefined; fallback?: string; eagerImages?: boolean; renderImages?: boolean }) {
  if (!text) return fallback ? <div className="rich-content"><span>{fallback}</span></div> : null
  return <div className="rich-content">{contentParts(text).map((part, index) => part.type === 'image'
    ? renderImages
    ? <ContentImage eager={eagerImages} id={part.id} key={`${part.id}-${index}`} />
    : null
    : part.value && <div className="rich-content-text" key={index}>
      <ReactMarkdown
        components={{
          a: ({ children, href }) => {
            const safeHref = typeof href === 'string' && href.startsWith('www.') ? `https://${href}` : href
            return <a className="task-description-link" href={safeHref} rel="noopener noreferrer" target="_blank">{children}</a>
          },
          img: () => null,
        }}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, MARKDOWN_SCHEMA]]}
        remarkPlugins={[remarkGfm, remarkBreaks]}
      >
        {part.value}
      </ReactMarkdown>
    </div>)}</div>
}
