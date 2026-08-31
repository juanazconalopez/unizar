import { createTeamAnnouncement, deleteTeamAnnouncement, updateTeamAnnouncement, updateTeamAnnouncementStatus } from '../../services/announcementsService'
import type { AnnouncementValues, TaskStatus, TeamAnnouncement } from '../../types'
import type { ActionContext } from './actionContext'

export function createAnnouncementActions(context: ActionContext) {
  return {
    save: async (announcement: TeamAnnouncement | undefined, values: AnnouncementValues) => {
      context.requireConnection()
      if (!context.userId) return
      if (announcement) await updateTeamAnnouncement(announcement.id, values)
      else await createTeamAnnouncement(values, context.userId)
      context.notify(announcement ? 'Aviso actualizado.' : 'Aviso creado.')
      await context.reloadData()
    },
    delete: async (announcement: TeamAnnouncement) => {
      context.requireConnection()
      await deleteTeamAnnouncement(announcement.id)
      context.notify('Aviso eliminado.')
      await context.reloadData()
    },
    changeStatus: async (id: string, status: TaskStatus) => {
      context.requireConnection()
      await updateTeamAnnouncementStatus(id, status)
      context.notify('Estado del aviso actualizado.')
      await context.reloadData()
    },
  }
}

export type AnnouncementActions = ReturnType<typeof createAnnouncementActions>
