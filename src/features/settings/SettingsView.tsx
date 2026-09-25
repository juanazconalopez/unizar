import { PageHeader } from '../../components/ui/PageHeader'
import { todayIso } from '../../lib/dates'
import type { LibrarySettings, ManagedProfileValues, PlayerAbsence, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonCompetition, SeasonPlayer, SeasonTeam, SeasonTeamCoach, SeasonValues } from '../../types'
import { SeasonsView } from '../seasons/SeasonsView'
import { TeamView } from '../team/TeamView'
import { LibrarySettingsView } from '../library/LibrarySettingsView'
import { PermissionsSettingsView } from './PermissionsSettingsView'
import type { ConfigurableRole, PermissionDefinition, PermissionKey, RolePermission } from '../../lib/permissions'
import type { SeasonCompetitionValues } from '../../services/seasonCompetitionsService'
import type { SeasonTeamValues } from '../../services/seasonTeamsService'
import type { PlayerAbsenceValues } from '../../services/playerAbsencesService'

type SettingsSection = 'team' | 'seasons' | 'library' | 'permissions'

export function SettingsView({ section: requestedSection, currentUserId, memberships, profiles, profilePrivateDetails = [], provisionalPlayers = [], provisionalAttendance = [], playerAbsences = [], seasons, seasonCompetitions = [], seasonTeams = [], seasonTeamCoaches = [], holidays, librarySettings = null, permissionDefinitions = [], rolePermissions = [], onCreateSeason, onDeleteSeason, onUpdateProfile, onUpdateProfileDetails, onArchiveProfile, onLoadProfilePhoto, onLinkProvisionalPlayers, onSavePlayerAbsence, onDeletePlayerAbsence, onUpdateSeason, onSaveHolidays, onCreateSeasonCompetition, onDeleteSeasonCompetition, onSetDefaultSeasonCompetition, onUpdateSeasonCompetition, onCreateSeasonTeam, onUpdateSeasonTeam, onDeleteSeasonTeam, onAssignSeasonPlayerTeam, onAssignSeasonTeamCoach, onSaveLibraryFolder, onSyncLibrary, onSaveRolePermissions, onResetRolePermissions }: {
  section?: SettingsSection
  currentUserId: string
  memberships: SeasonPlayer[]
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  playerAbsences?: PlayerAbsence[]
  seasons: Season[]
  seasonCompetitions?: SeasonCompetition[]
  seasonTeams?: SeasonTeam[]
  seasonTeamCoaches?: SeasonTeamCoach[]
  holidays?: { season_id: string; holiday_date: string }[]
  librarySettings?: LibrarySettings | null
  permissionDefinitions?: PermissionDefinition[]
  rolePermissions?: RolePermission[]
  onCreateSeason: (values: SeasonValues) => Promise<void>
  onDeleteSeason: (season: Season) => Promise<void>
  onToggleMembership?: (season: Season, player: Profile, active: boolean) => Promise<void>
  onArchiveProfile?: (profile: Profile) => Promise<void>
  onLoadProfilePhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
  onSavePlayerAbsence?: (player: Profile, values: PlayerAbsenceValues, absenceId?: string) => Promise<void>
  onDeletePlayerAbsence?: (absenceId: string) => Promise<void>
  onUpdateProfile: (profile: Profile) => Promise<void>
  onUpdateProfileDetails?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onUpdateSeason: (season: Season, values: SeasonValues) => Promise<void>
  onSaveHolidays?: (seasonId: string, dates: string[]) => Promise<void>
  onCreateSeasonCompetition?: (season: Season, values: SeasonCompetitionValues) => Promise<void>
  onDeleteSeasonCompetition?: (competition: SeasonCompetition) => Promise<void>
  onSetDefaultSeasonCompetition?: (competition: SeasonCompetition) => Promise<void>
  onUpdateSeasonCompetition?: (competition: SeasonCompetition, values: SeasonCompetitionValues) => Promise<void>
  onCreateSeasonTeam?: (season: Season, values: Pick<SeasonTeamValues, 'name' | 'isMixed'>) => Promise<void>
  onUpdateSeasonTeam?: (team: SeasonTeam, values: SeasonTeamValues) => Promise<void>
  onDeleteSeasonTeam?: (team: SeasonTeam) => Promise<void>
  onAssignSeasonPlayerTeam?: (season: Season, player: Profile, teamId: string) => Promise<void>
  onAssignSeasonTeamCoach?: (team: SeasonTeam, coach: Profile, assigned: boolean) => Promise<void>
  onSaveLibraryFolder?: (folderUrl: string) => Promise<void>
  onSyncLibrary?: () => Promise<void>
  onSaveRolePermissions?: (role: ConfigurableRole, permissions: PermissionKey[]) => Promise<void>
  onResetRolePermissions?: (role: ConfigurableRole) => Promise<void>
}) {
  const hasActiveSeason = seasons.some((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
  const section = requestedSection ?? (hasActiveSeason ? 'team' : 'seasons')
  const sectionTitle = section === 'team' ? 'Equipo' : section === 'seasons' ? 'Temporadas' : section === 'library' ? 'Librería' : 'Permisos'
  return <div className="page settings-page">
    <PageHeader eyebrow="ADMINISTRACIÓN" title={`Ajustes - ${sectionTitle}`} subtitle="Gestiona la estructura y los accesos del club." />
    {section === 'team' && <TeamView currentUserId={currentUserId} embedded hideEmbeddedTitle playerAbsences={playerAbsences} profiles={profiles} profilePrivateDetails={profilePrivateDetails} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} onArchive={onArchiveProfile} onDeleteAbsence={onDeletePlayerAbsence} onLinkProvisionalPlayers={onLinkProvisionalPlayers} onLoadPhoto={onLoadProfilePhoto} onSave={onUpdateProfileDetails} onSaveAbsence={onSavePlayerAbsence} onUpdate={onUpdateProfile} />}
    {section === 'seasons' && <SeasonsView embedded hideEmbeddedTitle competitions={seasonCompetitions} holidays={holidays} memberships={memberships} profiles={profiles} profilePrivateDetails={profilePrivateDetails} teamCoaches={seasonTeamCoaches} teams={seasonTeams} seasons={seasons} onAssignPlayerTeam={onAssignSeasonPlayerTeam} onAssignTeamCoach={onAssignSeasonTeamCoach} onCreate={onCreateSeason} onCreateCompetition={onCreateSeasonCompetition} onCreateTeam={onCreateSeasonTeam} onDelete={onDeleteSeason} onDeleteCompetition={onDeleteSeasonCompetition} onDeleteTeam={onDeleteSeasonTeam} onSaveHolidays={onSaveHolidays} onSetDefaultCompetition={onSetDefaultSeasonCompetition} onUpdate={onUpdateSeason} onUpdateCompetition={onUpdateSeasonCompetition} onUpdateTeam={onUpdateSeasonTeam} />}
    {section === 'library' && <LibrarySettingsView hideEmbeddedTitle settings={librarySettings} onSaveFolder={onSaveLibraryFolder} onSync={onSyncLibrary} />}
    {section === 'permissions' && onSaveRolePermissions && onResetRolePermissions && <PermissionsSettingsView definitions={permissionDefinitions} grants={rolePermissions} onReset={onResetRolePermissions} onSave={onSaveRolePermissions} />}
  </div>
}
