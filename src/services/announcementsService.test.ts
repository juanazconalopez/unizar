import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ delete: vi.fn(), eq: vi.fn(), from: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('../lib/supabase', () => ({ supabase: { from: mocks.from } }))

import { createTeamAnnouncement, deleteTeamAnnouncement, updateTeamAnnouncement, updateTeamAnnouncementStatus } from './announcementsService'

const values = { seasonId: 'season-1', date: '2026-08-13', title: '  Material  ', description: '  Traed camiseta  ', status: 'published' as const }

describe('announcementsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.eq.mockReturnValue({ error: null })
    mocks.insert.mockResolvedValue({ error: null })
    mocks.update.mockReturnValue({ eq: mocks.eq })
    mocks.delete.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ delete: mocks.delete, insert: mocks.insert, update: mocks.update })
  })

  test('creates an announcement on the exact selected day', async () => {
    await createTeamAnnouncement(values, 'owner-1')
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ announcement_date: '2026-08-13', title: 'Material', description: 'Traed camiseta', created_by: 'owner-1' }))
  })

  test('updates status and deletes only the requested announcement', async () => {
    await updateTeamAnnouncement('announcement-1', values)
    await updateTeamAnnouncementStatus('announcement-1', 'cancelled')
    await deleteTeamAnnouncement('announcement-1')
    expect(mocks.eq).toHaveBeenCalledWith('id', 'announcement-1')
    expect(mocks.delete).toHaveBeenCalledOnce()
  })
})
