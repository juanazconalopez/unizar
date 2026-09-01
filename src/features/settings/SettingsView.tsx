import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { todayIso } from '../../lib/dates'
import type { Profile, ProfileDetailsValues, ProfilePrivateDetails, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonsView } from '../seasons/SeasonsView'
import { TeamView } from '../team/TeamView'

export function SettingsView({ currentUserId, memberships, profiles, profilePrivateDetails = [], seasons, onCreateSeason, onDeleteSeason, onToggleMembership, onUpdateProfile, onUpdateProfileDetails, onUpdateSeason }: {
  currentUserId: string
  memberships: SeasonPlayer[]
  profiles: Profile[]
  profilePrivateDetails?: ProfilePrivateDetails[]
  seasons: Season[]
  onCreateSeason: (values: SeasonValues) => Promise<void>
  onDeleteSeason: (season: Season) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
  onUpdateProfile: (profile: Profile) => Promise<void>
  onUpdateProfileDetails?: (profile: Profile, values: ProfileDetailsValues) => Promise<void>
  onUpdateSeason: (season: Season, values: SeasonValues) => Promise<void>
}) {
  const hasActiveSeason = seasons.some((season) => season.start_date <= todayIso() && season.end_date >= todayIso())
  const [section, setSection] = useState<'team' | 'seasons'>(hasActiveSeason ? 'team' : 'seasons')
  return <div className="page settings-page">
    <PageHeader eyebrow="ADMINISTRACIÓN" title="Ajustes" subtitle="Gestiona la estructura y los accesos del club." />
    <div aria-label="Secciones de ajustes" className="settings-tabs" role="tablist">
      <button aria-selected={section === 'team'} className={section === 'team' ? 'active' : ''} onClick={() => setSection('team')} role="tab">Equipo</button>
      <button aria-selected={section === 'seasons'} className={section === 'seasons' ? 'active' : ''} onClick={() => setSection('seasons')} role="tab">Temporadas</button>
    </div>
    {section === 'team' ? <TeamView currentUserId={currentUserId} embedded profiles={profiles} profilePrivateDetails={profilePrivateDetails} onUpdate={onUpdateProfile} onUpdateDetails={onUpdateProfileDetails} /> : <SeasonsView embedded memberships={memberships} profiles={profiles} profilePrivateDetails={profilePrivateDetails} seasons={seasons} onCreate={onCreateSeason} onDelete={onDeleteSeason} onUpdate={onUpdateSeason} onToggleMembership={onToggleMembership} />}
  </div>
}
