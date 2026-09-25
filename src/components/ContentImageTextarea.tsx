import { useEffect, useId, useRef, useState } from 'react'
import type { ClipboardEvent, ChangeEvent, TextareaHTMLAttributes } from 'react'
import { contentImageIds, contentImageToken, removeContentImageToken } from '../lib/contentImageTokens'
import { errorText } from '../lib/errors'
import { discardStagedContentImage, stageContentImage } from '../services/contentImagesService'
import { ContentImage } from './ContentImage'

type FormatAction = 'bold' | 'italic' | 'strike' | 'underline' | 'bullet' | 'number' | 'quote' | 'link'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange' | 'value'> & {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  maxImages?: number
  showFilePicker?: boolean
}

export function ContentImageTextarea({ label, value, onChange, className = '', maxImages = 8, showFilePicker = true, ...textareaProps }: Props) {
  const inputId = useId()
  const labelId = useId()
  const textareaId = useId()
  const editorRef = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const imageIds = contentImageIds(value)
  const placeholder = textareaProps.placeholder ?? ''

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    if (editor.innerHTML !== value) editor.innerHTML = value || ''
  }, [value])

  function syncEditorContent() {
    const editor = editorRef.current
    if (!editor) return
    const nextValue = editor.innerHTML
    if (nextValue !== value) onChange(nextValue)
  }

  function focusEditor() {
    editorRef.current?.focus()
  }

  function exec(command: string, valueArg?: string) {
    if (typeof document.execCommand !== 'function') {
      setMessage('Formato aplicado.')
      return
    }
    focusEditor()
    document.execCommand(command, false, valueArg)
    syncEditorContent()
    setMessage('Formato aplicado.')
  }

  function createLink() {
    if (busy || textareaProps.readOnly) return
    const link = window.prompt('Escribe la URL del enlace', 'https://')
    if (!link) return
    exec('createLink', link.trim())
  }

  function applyFormat(action: FormatAction) {
    if (busy || textareaProps.readOnly) return
    switch (action) {
      case 'bold':
        exec('bold')
        break
      case 'italic':
        exec('italic')
        break
      case 'strike':
        exec('strikeThrough')
        break
      case 'underline':
        exec('underline')
        break
      case 'bullet':
        exec('insertUnorderedList')
        break
      case 'number':
        exec('insertOrderedList')
        break
      case 'quote':
        exec('formatBlock', 'blockquote')
        break
      case 'link':
        createLink()
        break
    }
  }

  function insertTextAtCursor(text: string) {
    if (typeof document.execCommand !== 'function') {
      onChange([value.trimEnd(), text.trim(), ''].filter(Boolean).join('\n'))
      return
    }
    focusEditor()
    document.execCommand('insertText', false, text)
    syncEditorContent()
  }

  async function addFiles(files: File[]) {
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
      insertTextAtCursor(`\n${tokens.join('\n')}\n`)
      setMessage(files.length === 1 ? 'Imagen preparada. Se subirá al guardar.' : `${files.length} imágenes preparadas. Se subirán al guardar.`)
    } catch (error) {
      setMessage(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  function paste(event: ClipboardEvent<HTMLDivElement>) {
    const files = [...event.clipboardData.items]
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
    if (!files.length) return
    event.preventDefault()
    void addFiles(files)
  }

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])]
    event.target.value = ''
    void addFiles(files)
  }

  function removeImage(id: string) {
    onChange(removeContentImageToken(value, id))
    void discardStagedContentImage(id)
    setMessage('Imagen quitada.')
  }

  return <div className={`${className} content-image-field`.trim()}>
    <label id={labelId} htmlFor={textareaProps.id ?? textareaId}>{label}</label>
    <div
      aria-labelledby={labelId}
      aria-multiline="true"
      className="content-rich-editor"
      contentEditable={!busy && !textareaProps.readOnly}
      data-placeholder={placeholder}
      id={textareaProps.id ?? textareaId}
      onInput={syncEditorContent}
      onPaste={paste}
      ref={editorRef}
      role="textbox"
      suppressContentEditableWarning
    />
    {textareaProps.name && <input name={textareaProps.name} type="hidden" value={value} />}
    <span aria-label="Formato de texto" className="content-format-toolbar" role="toolbar">
      <button aria-label="Negrita" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('bold')} title="Negrita" type="button"><strong>B</strong></button>
      <button aria-label="Cursiva" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('italic')} title="Cursiva" type="button"><em>I</em></button>
      <button aria-label="Tachado" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('strike')} title="Tachado" type="button"><s>S</s></button>
      <button aria-label="Subrayado" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('underline')} title="Subrayado" type="button"><u>U</u></button>
      <button aria-label="Lista con viñetas" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('bullet')} title="Lista con viñetas" type="button">• Lista</button>
      <button aria-label="Lista numerada" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('number')} title="Lista numerada" type="button">1. Lista</button>
      <button aria-label="Cita" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('quote')} title="Cita" type="button">“ Cita</button>
      <button aria-label="Enlace" disabled={busy || textareaProps.readOnly} onClick={() => applyFormat('link')} title="Enlace" type="button">Enlace</button>
    </span>
    <span className="content-image-toolbar">
      <span>{busy ? 'Comprimiendo…' : 'Formato rápido: negrita, cursiva, tachado, subrayado, listas, cita y enlace. También puedes pegar una imagen desde el portapapeles.'}</span>
      {showFilePicker && <><label className="secondary-button compact content-image-file-button" htmlFor={inputId}>Añadir imagen</label><input accept="image/jpeg,image/png,image/webp" disabled={busy} id={inputId} multiple onChange={selectFiles} type="file" /></>}
    </span>
    {imageIds.length > 0 && <span className="content-image-previews">{imageIds.map((id, index) => <span className="content-image-preview" key={id}>
      <ContentImage compact id={id} />
      <button aria-label={`Quitar imagen ${index + 1}`} disabled={busy} onClick={() => removeImage(id)} type="button">×</button>
    </span>)}</span>}
    {message && <small aria-live="polite" className="content-image-message">{message}</small>}
  </div>
}
