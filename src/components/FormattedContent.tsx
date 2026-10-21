import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

const MARKDOWN_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
}

export default function FormattedContent({ text }: { text: string }) {
  return <ReactMarkdown
    components={{
      a: ({ children, href }) => {
        const safeHref = typeof href === 'string' && href.startsWith('www.') ? `https://${href}` : href
        return <a className="task-description-link" href={safeHref} rel="noopener noreferrer" target="_blank">{children}</a>
      },
      img: () => null,
    }}
    rehypePlugins={[rehypeRaw, [rehypeSanitize, MARKDOWN_SCHEMA]]}
    remarkPlugins={[remarkGfm, remarkBreaks]}
  >{text}</ReactMarkdown>
}
