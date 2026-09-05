import { PageHeader } from '../../components/ui/PageHeader'
import { todayIso } from '../../lib/dates'
import type { LibrarySettings, ManagedProfileValues, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonsView } from '../seasons/SeasonsView'
import { TeamView } from '../team/TeamView'
import { LibrarySettingsView } from '../library/LibrarySettingsView'

type SettingsSection = 'team' | 'seasons' | 'library'

export function SettingsView({ section: requestedSection, currentUserId, memberships, profiles, profilePrivateDetails = [], provisionalPlayers = [], provisionalAttendance = [], seasons, librarySettings = null, onCreateSeason, onDeleteSeason, onToggleMembership, onUpdateProfile, onUpdateProfileDetails, onArchiveProfile, onLoadProfilePhoto, onLinkProvisionalPlayers, onUpdateSeason, onSaveLibraryFolder, onSyncLibrary }: {
  section?: SettingsSection
  currentUserId: string
  memberships: SeasonPlayer[]
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  seasons: Season[]
  librarySettings?: LibrarySettings | null
  onCreateSeason: (values: SeasonValues) => Promise<void>
  onDeleteSeason: (season: Season) => Promise<void>
  onArchiveProfile?: (profile: Profile) => Promise<void>
  onLoadProfilePhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
  onUpdateProfile: (profile: Profile) => Promise<void>
  onUpdateProfileDetails?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onUpdateSeason: (season: Season, values: SeasonValues) => Promise<void>
  onSaveLibraryFolder?: (folderUrl: string) => Promise<void>
  onSyncLibrary?: () => Promise<void>
}) {
  const hasActiveSeason = seasons.some((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
  const section = requestedSection ?? (hasActiveSeason ? 'team' : 'seasons')
  const sectionTitle = section === 'team' ? 'Equipo' : section === 'seasons' ? 'Temporadas' : 'Librería'
  return <div className="page settings-page">
    <PageHeader eyebrow="ADMINISTRACIÓN" title={`Ajustes - ${sectionTitle}`} subtitle="Gestiona la estructura y los accesos del club." />
    {section === 'team' && <TeamView currentUserId={currentUserId} embedded hideEmbeddedTitle profiles={profiles} profilePrivateDetails={profilePrivateDetails} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} onArchive={onArchiveProfile} onLinkProvisionalPlayers={onLinkProvisionalPlayers} onLoadPhoto={onLoadProfilePhoto} onSave={onUpdateProfileDetails} onUpdate={onUpdateProfile} />}
    {section === 'seasons' && <SeasonsView embedded hideEmbeddedTitle memberships={memberships} profiles={profiles} profilePrivateDetails={profilePrivateDetails} seasons={seasons} onCreate={onCreateSeason} onDelete={onDeleteSeason} onUpdate={onUpdateSeason} onToggleMembership={onToggleMembership} />}
    {section === 'library' && <LibrarySettingsView hideEmbeddedTitle settings={librarySettings} onSaveFolder={onSaveLibraryFolder} onSync={onSyncLibrary} />}
  </div>
}
