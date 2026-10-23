import { useCallback, useEffect, useRef, useState } from 'react'
import { monthEnd, monthStart } from '../lib/dates'
import { errorText } from '../lib/errors'
import type { SaveTrainingResponse, TrainingPlanCalendarItem } from '../types'
import type { SessionQueryCache } from '../services/sessionQueryCache'

export function useCalendarTrainings(month: string, loader?: (from: string, until: string) => Promise<TrainingPlanCalendarItem[]>, save?: SaveTrainingResponse, resources?: SessionQueryCache) {
  const key = `training-calendar:${month}`
  const [snapshot, setSnapshot] = useState<{ month: string; plans: TrainingPlanCalendarItem[] }>(() => ({ month, plans: resources?.peek(key) ?? [] }))
  const [error, setError] = useState('')
  const request = useRef(0)
  const reload = useCallback(async (force = false, isCurrent: () => boolean = () => true) => {
    if (!loader) return
    const version = ++request.current
    try {
      const fetcher = () => loader(monthStart(month), monthEnd(month))
      const plans = await (resources ? resources.load(`training-calendar:${month}`, fetcher, { force }) : fetcher())
      if (isCurrent() && version === request.current) { setSnapshot({ month, plans }); setError('') }
    } catch (cause) {
      if (isCurrent() && version === request.current) setError(errorText(cause))
    }
  }, [loader, month, resources])
  useEffect(() => {
    let current = true
    const timer = window.setTimeout(() => void reload(false, () => current), 0)
    const refresh = () => { if (document.visibilityState === 'visible') void reload(true) }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => { current = false; window.clearTimeout(timer); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
  }, [reload])
  const respond: SaveTrainingResponse | undefined = save ? async (plan, attending, comment) => {
    try {
      await save(plan, attending, comment)
      setSnapshot((current) => ({ ...current, plans: current.plans.map((item) => item.id === plan.id ? {
        ...item,
        attending_count: item.attending_count == null ? undefined : Math.max(0, item.attending_count + Number(attending) - Number(item.own_attending === true)),
        own_attending: attending, own_comment: comment.trim(), response_stale: false,
      } : item) }))
      await reload(true)
    } catch (cause) { await reload(true); throw cause }
  } : undefined
  return { plans: snapshot.month === month ? snapshot.plans : resources?.peek<TrainingPlanCalendarItem[]>(key) ?? [], error, reload, respond }
}
