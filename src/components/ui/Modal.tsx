import { useEffect, useId, useRef } from 'react'
import type { FormEventHandler, ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Modal({ children, className, disabled = false, labelledBy, onClose, onFormChange, onSubmit }: {
  children: ReactNode
  className?: string
  disabled?: boolean
  labelledBy: string
  onClose: () => void
  onFormChange?: FormEventHandler<HTMLFormElement>
  onSubmit?: FormEventHandler<HTMLFormElement>
}) {
  const fallbackId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    const pageContent = document.querySelector<HTMLElement>('.content')
    const previousContentOverflow = pageContent?.style.overflow ?? ''
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    if (pageContent) pageContent.style.overflow = 'hidden'
    const frame = window.requestAnimationFrame(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>('[autofocus], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
      focusable?.focus()
    })
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && !disabled) onCloseRef.current()
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      if (pageContent) pageContent.style.overflow = previousContentOverflow
      window.removeEventListener('keydown', handleKey)
      previousFocus?.focus()
    }
  }, [disabled])

  return createPortal(
    <div className="task-detail-backdrop" onClick={() => { if (!disabled) onClose() }}>
      <div
        aria-labelledby={labelledBy || fallbackId}
        aria-modal="true"
        className={`task-detail-dialog${className ? ` ${className}` : ''}`}
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        {onSubmit ? <form className="modal-form-contents" onChange={onFormChange} onSubmit={onSubmit}>{children}</form> : children}
      </div>
    </div>,
    document.body,
  )
}
