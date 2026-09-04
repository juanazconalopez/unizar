import type { AnnouncementActions } from './announcementActions'
import type { ClubActions } from './clubActions'
import type { MatchActions } from './matchActions'
import type { TaskActions } from './taskActions'
import type { LibraryActions } from './libraryActions'

export type AppActions = {
  announcements: AnnouncementActions
  club: ClubActions
  matches: MatchActions
  tasks: TaskActions
  library: LibraryActions
}
