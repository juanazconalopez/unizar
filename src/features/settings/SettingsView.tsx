import { PageHeader } from '../../components/ui/PageHeader'
import { todayIso } from '../../lib/dates'
import type { LibrarySettings, ManagedProfileValues, Profile, ProfilePhotoChange, ProfilePrivateDetails, ProvisionalAttendanceRecord, ProvisionalPlayer, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonsView } from '../seasons/SeasonsView'
import { TeamView } from '../team/TeamView'
import { LibrarySettingsView } from '../library/LibrarySettingsView'
import { PermissionsSettingsView } from './PermissionsSettingsView'
import type { ConfigurableRole, PermissionDefinition, PermissionKey, RolePermission } from '../../lib/permissions'

type SettingsSection = 'team' | 'seasons' | 'library' | 'permissions'

export function SettingsView({ section: requestedSection, currentUserId, memberships, profiles, profilePrivateDetails = [], provisionalPlayers = [], provisionalAttendance = [], seasons, holidays, librarySettings = null, permissionDefinitions = [], rolePermissions = [], onCreateSeason, onDeleteSeason, onToggleMembership, onUpdateProfile, onUpdateProfileDetails, onArchiveProfile, onLoadProfilePhoto, onLinkProvisionalPlayers, onUpdateSeason, onSaveHolidays, onSaveLibraryFolder, onSyncLibrary, onSaveRolePermissions, onResetRolePermissions }: {
  section?: SettingsSection
  currentUserId: string
  memberships: SeasonPlayer[]
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  provisionalPlayers?: ProvisionalPlayer[]
  provisionalAttendance?: ProvisionalAttendanceRecord[]
  seasons: Season[]
  holidays?: { season_id: string; holiday_date: string }[]
  librarySettings?: LibrarySettings | null
  permissionDefinitions?: PermissionDefinition[]
  rolePermissions?: RolePermission[]
  onCreateSeason: (values: SeasonValues) => Promise<void>
  onDeleteSeason: (season: Season) => Promise<void>
  onArchiveProfile?: (profile: Profile) => Promise<void>
  onLoadProfilePhoto?: (path: string) => Promise<string>
  onLinkProvisionalPlayers?: (guests: ProvisionalPlayer[], profile: Profile) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
  onUpdateProfile: (profile: Profile) => Promise<void>
  onUpdateProfileDetails?: (profile: Profile, values: ManagedProfileValues, photoChange?: ProfilePhotoChange) => Promise<void>
  onUpdateSeason: (season: Season, values: SeasonValues) => Promise<void>
  onSaveHolidays?: (seasonId: string, dates: string[]) => Promise<void>
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
    {section === 'team' && <TeamView currentUserId={currentUserId} embedded hideEmbeddedTitle profiles={profiles} profilePrivateDetails={profilePrivateDetails} provisionalAttendance={provisionalAttendance} provisionalPlayers={provisionalPlayers} onArchive={onArchiveProfile} onLinkProvisionalPlayers={onLinkProvisionalPlayers} onLoadPhoto={onLoadProfilePhoto} onSave={onUpdateProfileDetails} onUpdate={onUpdateProfile} />}
    {section === 'seasons' && <SeasonsView embedded hideEmbeddedTitle holidays={holidays} memberships={memberships} profiles={profiles} profilePrivateDetails={profilePrivateDetails} seasons={seasons} onCreate={onCreateSeason} onDelete={onDeleteSeason} onSaveHolidays={onSaveHolidays} onUpdate={onUpdateSeason} onToggleMembership={onToggleMembership} />}
    {section === 'library' && <LibrarySettingsView hideEmbeddedTitle settings={librarySettings} onSaveFolder={onSaveLibraryFolder} onSync={onSyncLibrary} />}
    {section === 'permissions' && onSaveRolePermissions && onResetRolePermissions && <PermissionsSettingsView definitions={permissionDefinitions} grants={rolePermissions} onReset={onResetRolePermissions} onSave={onSaveRolePermissions} />}
  </div>
}
