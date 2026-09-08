import { useId, useRef, useState } from 'react'
import type { ClipboardEvent, ChangeEvent, TextareaHTMLAttributes } from 'react'
import { contentImageIds, contentImageToken, removeContentImageToken } from '../lib/contentImageTokens'
import { errorText } from '../lib/errors'
import { discardStagedContentImage, stageContentImage } from '../services/contentImagesService'
import { ContentImage } from './ContentImage'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  maxImages?: number
}

export function ContentImageTextarea({ label, value, onChange, className = '', maxImages = 8, ...textareaProps }: Props) {
  const inputId = useId()
  const textareaId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const imageIds = contentImageIds(value)

  async function addFiles(files: File[], selectionStart?: number, selectionEnd?: number) {
    if (!files.length) return
    if (imageIds.length + files.length > maxImages) {
      setMessage(`Puedes añadir hasta ${maxImages} imágenes en este campo.`)
      return
    }
    setBusy(true)
    setMessage('Preparando imagen…')
    try {
      const tokens: string[] = []
      for (const file of files) tokens.push(contentImageToken(await stageContentImage(file)))
      const start = selectionStart ?? value.length
      const end = selectionEnd ?? start
      const before = value.slice(0, start).replace(/\s*$/, '')
      const after = value.slice(end).replace(/^\s*/, '')
      const insertion = tokens.join('\n')
      onChange([before, insertion, after].filter(Boolean).join('\n'))
      setMessage(files.length === 1 ? 'Imagen preparada. Se subirá al guardar.' : `${files.length} imágenes preparadas. Se subirán al guardar.`)
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  function paste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (!files.length) return
    event.preventDefault()
    void addFiles(files, event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    void addFiles(files, textareaRef.current?.selectionStart, textareaRef.current?.selectionEnd)
  }

  function removeImage(id: string) {
    onChange(removeContentImageToken(value, id))
    void discardStagedContentImage(id)
    setMessage('Imagen quitada.')
  }

  return <div className={`${className} content-image-field`.trim()}>
    <label htmlFor={textareaProps.id ?? textareaId}>{label}</label>
    <textarea {...textareaProps} id={textareaProps.id ?? textareaId} onChange={(event) => onChange(event.target.value)} onPaste={paste} readOnly={busy || textareaProps.readOnly} ref={textareaRef} value={value} />
    <span className="content-image-toolbar">
      <span>{busy ? 'Comprimiendo…' : 'Puedes pegar una imagen desde el portapapeles.'}</span>
      <label className="secondary-button compact content-image-file-button" htmlFor={inputId}>Añadir imagen</label>
      <input accept="image/jpeg,image/png,image/webp" disabled={busy} id={inputId} multiple onChange={selectFiles} type="file" />
    </span>
    {imageIds.length > 0 && <span className="content-image-previews">{imageIds.map((id, index) => <span className="content-image-preview" key={id}>
      <ContentImage compact id={id} />
      <button aria-label={`Quitar imagen ${index + 1}`} disabled={busy} onClick={() => removeImage(id)} type="button">×</button>
    </span>)}</span>}
    {message && <small aria-live="polite" className="content-image-message">{message}</small>}
  </div>
}
