import { useEffect, useMemo, useState } from 'react'
import { fetchSeasonHolidays } from '../services/seasonHolidaysService'

export function useSeasonHolidayDates(seasonIds: string[], providedHolidays?: string[]) {
  const [loadedHolidays, setLoadedHolidays] = useState<string[]>([])
  const seasonKey = useMemo(() => [...new Set(seasonIds)].sort().join(','), [seasonIds])

  useEffect(() => {
    if (providedHolidays) return
    let cancelled = false
    void fetchSeasonHolidays(seasonKey ? seasonKey.split(',') : [])
      .then((items) => { if (!cancelled) setLoadedHolidays(items.map((item) => item.holiday_date)) })
      .catch(() => { if (!cancelled) setLoadedHolidays([]) })
    return () => { cancelled = true }
  }, [providedHolidays, seasonKey])

  return providedHolidays ?? loadedHolidays
}
