import { describe, expect, test, vi } from 'vitest'
import { fetchAllPages, QUERY_PAGE_SIZE } from './queryPagination'

describe('complete paginated queries', () => {
  test('retrieves more than the API default limit without duplicates', async () => {
    const rows = Array.from({ length: 1251 }, (_, id) => ({ id }))
    const load = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    expect(await fetchAllPages(load)).toEqual({ data: rows, error: null })
    expect(load.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
  })

  test('does not make another request for a small collection', async () => {
    const load = vi.fn(async () => ({ data: [{ id: 1 }], error: null }))
    expect((await fetchAllPages(load)).data).toEqual([{ id: 1 }])
    expect(load).toHaveBeenCalledOnce()
  })

  test('checks for the end after an exact full page and never returns partial data on failure', async () => {
    const error = { message: 'Sin conexión' }
    const load = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: QUERY_PAGE_SIZE }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: null, error })
    expect(await fetchAllPages(load)).toEqual({ data: null, error })
    expect(load).toHaveBeenCalledTimes(2)
  })
})
