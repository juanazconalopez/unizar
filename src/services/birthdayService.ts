import { supabase } from '../lib/supabase'
import { readLocalStorage, removeLocalStorageByPrefix, removeLocalStorageItem, writeLocalStorage } from '../lib/browserStorage'
import type { CalendarBirthday, SeasonBirthday, TodayBirthday } from '../types'

const CACHE_PREFIX = 'unizar:birthdays:'
let cacheUserId: string | null | undefined
let cacheEpoch = 0

export function setBirthdayCacheUser(userId: string | null) {
  if (cacheUserId === userId) return
  cacheUserId = userId
  cacheEpoch += 1
  // Elimina otras cuentas y las claves antiguas que no identificaban al usuario.
  removeLocalStorageByPrefix(CACHE_PREFIX, userId ? `${CACHE_PREFIX}user:${userId}:` : undefined)
}

type DailyCache<T> = {
  storedOn: string
  data: T
}

export async function fetchTodayBirthdays(userId: string, today: string): Promise<TodayBirthday[]> {
  const key = `${CACHE_PREFIX}user:${userId}:today`
  const epoch = cacheEpoch
  const cached = readDailyCache<TodayBirthday[]>(key, today)
  if (cached) return cached

  const { data, error } = await supabase.rpc('get_today_active_player_birthdays')
  if (error) throw error
  const birthdays = data ?? []
  if (epoch === cacheEpoch) writeDailyCache(key, today, birthdays)
  return birthdays
}

export async function fetchActiveSeasonBirthdays(userId: string, seasonId: string, today: string): Promise<SeasonBirthday[]> {
  const key = `${CACHE_PREFIX}user:${userId}:season:${seasonId}`
  const epoch = cacheEpoch
  const cached = readDailyCache<SeasonBirthday[]>(key, today)
  if (cached) return cached

  const { data, error } = await supabase.rpc('get_active_season_birthdays')
  if (error) throw error
  const birthdays = data ?? []
  if (epoch === cacheEpoch) writeDailyCache(key, today, birthdays)
  return birthdays
}

export async function fetchPlayerCalendarBirthdays(userId: string, seasonId: string, today: string): Promise<CalendarBirthday[]> {
  const key = `${CACHE_PREFIX}user:${userId}:calendar:${seasonId}`
  const epoch = cacheEpoch
  const cached = readDailyCache<CalendarBirthday[]>(key, today)
  if (cached) return cached

  const { data, error } = await supabase.rpc('get_player_season_birthday_calendar')
  if (error) throw error
  const birthdays = data ?? []
  if (epoch === cacheEpoch) writeDailyCache(key, today, birthdays)
  return birthdays
}

/** Clears derived birthday data after a local profile, roster or season change. */
export function invalidateBirthdayCache() {
  cacheEpoch += 1
  removeLocalStorageByPrefix(CACHE_PREFIX)
}

function readDailyCache<T>(key: string, today: string): T | null {
  try {
    const cached = JSON.parse(readLocalStorage(key) ?? 'null') as DailyCache<T> | null
    return cached?.storedOn === today ? cached.data : null
  } catch {
    removeLocalStorageItem(key)
    return null
  }
}

function writeDailyCache<T>(key: string, today: string, data: T) {
  writeLocalStorage(key, JSON.stringify({ storedOn: today, data } satisfies DailyCache<T>))
}
