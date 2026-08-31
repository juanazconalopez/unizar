import { useCallback, useEffect, useMemo, useState } from 'react'
import type { TrainingPlanValues } from '../../types'

const DRAFT_VERSION = 1
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const AUTOSAVE_DELAY_MS = 800

type StoredTrainingPlanDraft = {
  version: number
  savedAt: number
  values: TrainingPlanValues
}

export type TrainingPlanDraftStatus = 'idle' | 'saving' | 'saved' | 'recovered' | 'error'

export function trainingPlanDraftKey(userId: string, planId?: string, templateId?: string) {
  const editorId = planId ?? (templateId ? `duplicate-${templateId}` : 'new')
  return `unizar:training-plan-draft:${userId}:${editorId}`
}

export function loadTrainingPlanDraft(storageKey: string): TrainingPlanValues | null {
  if (!storageAvailable()) return null
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey) ?? 'null') as unknown
    if (!isStoredTrainingPlanDraft(draft) || Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(storageKey)
      return null
    }
    return draft.values
  } catch {
    localStorage.removeItem(storageKey)
    return null
  }
}

export function storeTrainingPlanDraft(storageKey: string, values: TrainingPlanValues) {
  if (!storageAvailable()) return false
  try {
    const draft: StoredTrainingPlanDraft = { version: DRAFT_VERSION, savedAt: Date.now(), values }
    localStorage.setItem(storageKey, JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function removeTrainingPlanDraft(storageKey: string) {
  if (!storageAvailable()) return
  try { localStorage.removeItem(storageKey) } catch { /* A disabled storage must not break the editor. */ }
}

export function useTrainingPlanDraft({ storageKey, initialValues, values, onRecover }: {
  storageKey: string
  initialValues: TrainingPlanValues
  values: TrainingPlanValues
  onRecover: (values: TrainingPlanValues) => void
}) {
  const initialSnapshot = useMemo(() => JSON.stringify(initialValues), [initialValues])
  const [pendingDraft, setPendingDraft] = useState<TrainingPlanValues | null>(() => {
    const stored = loadTrainingPlanDraft(storageKey)
    return stored && JSON.stringify(stored) !== initialSnapshot ? stored : null
  })
  const [persistedSnapshot, setPersistedSnapshot] = useState(initialSnapshot)
  const [persistedStatus, setPersistedStatus] = useState<TrainingPlanDraftStatus>('idle')
  const valuesSnapshot = JSON.stringify(values)
  const status: TrainingPlanDraftStatus = valuesSnapshot === initialSnapshot
    ? 'idle'
    : valuesSnapshot !== persistedSnapshot
      ? 'saving'
      : persistedStatus

  const persist = useCallback((nextValues: TrainingPlanValues, updateStatus = true) => {
    const nextSnapshot = JSON.stringify(nextValues)
    if (nextSnapshot === initialSnapshot) {
      removeTrainingPlanDraft(storageKey)
      if (updateStatus) {
        setPersistedSnapshot(nextSnapshot)
        setPersistedStatus('idle')
      }
      return
    }
    const stored = storeTrainingPlanDraft(storageKey, nextValues)
    if (updateStatus) {
      setPersistedSnapshot(nextSnapshot)
      setPersistedStatus(stored ? 'saved' : 'error')
    }
  }, [initialSnapshot, storageKey])

  const saveNow = useCallback(() => {
    if (!pendingDraft) persist(values)
  }, [pendingDraft, persist, values])

  const recoverDraft = useCallback(() => {
    if (!pendingDraft) return
    onRecover(pendingDraft)
    setPersistedSnapshot(JSON.stringify(pendingDraft))
    setPendingDraft(null)
    setPersistedStatus('recovered')
  }, [onRecover, pendingDraft])

  const discardDraft = useCallback(() => {
    removeTrainingPlanDraft(storageKey)
    setPendingDraft(null)
    setPersistedSnapshot(initialSnapshot)
    setPersistedStatus('idle')
  }, [initialSnapshot, storageKey])

  const clearDraft = useCallback(() => {
    removeTrainingPlanDraft(storageKey)
    setPendingDraft(null)
    setPersistedSnapshot(initialSnapshot)
    setPersistedStatus('idle')
  }, [initialSnapshot, storageKey])

  useEffect(() => {
    if (pendingDraft) return
    if (valuesSnapshot === initialSnapshot) {
      removeTrainingPlanDraft(storageKey)
      return
    }
    const timeoutId = window.setTimeout(() => persist(values), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timeoutId)
  }, [initialSnapshot, pendingDraft, persist, storageKey, values, valuesSnapshot])

  useEffect(() => {
    function preserveBeforeLeaving() {
      if (!pendingDraft) persist(values, false)
    }
    function preserveWhenHidden() {
      if (document.visibilityState === 'hidden') preserveBeforeLeaving()
    }
    window.addEventListener('beforeunload', preserveBeforeLeaving)
    document.addEventListener('visibilitychange', preserveWhenHidden)
    return () => {
      window.removeEventListener('beforeunload', preserveBeforeLeaving)
      document.removeEventListener('visibilitychange', preserveWhenHidden)
    }
  }, [pendingDraft, persist, values])

  return { pendingDraft, status, saveNow, recoverDraft, discardDraft, clearDraft }
}

function isStoredTrainingPlanDraft(value: unknown): value is StoredTrainingPlanDraft {
  if (!isRecord(value) || value.version !== DRAFT_VERSION || typeof value.savedAt !== 'number') return false
  const plan = value.values
  if (!isRecord(plan)
    || typeof plan.seasonId !== 'string'
    || typeof plan.sessionDate !== 'string'
    || typeof plan.title !== 'string'
    || typeof plan.objectives !== 'string'
    || typeof plan.material !== 'string'
    || !['draft', 'published', 'cancelled'].includes(String(plan.status))
    || !Array.isArray(plan.exercises)) return false
  return plan.exercises.every((exercise) => isRecord(exercise)
    && typeof exercise.title === 'string'
    && typeof exercise.description === 'string'
    && typeof exercise.durationMinutes === 'number'
    && isRecord(exercise.diagramData)
    && Array.isArray(exercise.diagramData.elements))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

function storageAvailable() {
  return typeof localStorage !== 'undefined'
}
