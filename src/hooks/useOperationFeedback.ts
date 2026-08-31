import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from '../lib/errors'

export function useOperationFeedback() {
  const [message, setMessage] = useState('')
  const [operationError, setOperationError] = useState('')
  const messageTimer = useRef<number | null>(null)

  const clearError = useCallback(() => setOperationError(''), [])

  const notify = useCallback((text: string) => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
    setMessage(text)
    setOperationError('')
    messageTimer.current = window.setTimeout(() => {
      setMessage('')
      messageTimer.current = null
    }, 3500)
  }, [])

  const reportError = useCallback((error: unknown) => {
    const text = errorText(error)
    setOperationError(text)
    return text
  }, [])

  const requireConnection = useCallback(() => {
    if (navigator.onLine) return
    const error = new Error('Sin conexión. Recupera Internet antes de guardar cambios.')
    setOperationError(error.message)
    throw error
  }, [])

  useEffect(() => () => {
    if (messageTimer.current !== null) window.clearTimeout(messageTimer.current)
  }, [])

  return { message, operationError, clearError, notify, reportError, requireConnection }
}
