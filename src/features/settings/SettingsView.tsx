import { useState } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import type { Profile, Season, SeasonPlayer, SeasonValues } from '../../types'
import { SeasonsView } from '../seasons/SeasonsView'
import { TeamView } from '../team/TeamView'

export function SettingsView({ currentUserId, memberships, profiles, seasons, onCreateSeason, onToggleMembership, onUpdateProfile }: {
  currentUserId: string
  memberships: SeasonPlayer[]
  profiles: Profile[]
  seasons: Season[]
  onCreateSeason: (values: SeasonValues) => Promise<void>
  onToggleMembership: (season: Season, player: Profile, active: boolean) => Promise<void>
  onUpdateProfile: (profile: Profile) => Promise<void>
}) {
  const [section, setSection] = useState<'team' | 'seasons'>('team')
  return <div className="page settings-page">
    <PageHeader eyebrow="ADMINISTRACIÓN" title="Ajustes" subtitle="Gestiona la estructura y los accesos del club." />
    <div aria-label="Secciones de ajustes" className="settings-tabs" role="tablist">
      <button aria-selected={section === 'team'} className={section === 'team' ? 'active' : ''} onClick={() => setSection('team')} role="tab">Equipo</button>
      <button aria-selected={section === 'seasons'} className={section === 'seasons' ? 'active' : ''} onClick={() => setSection('seasons')} role="tab">Temporadas</button>
    </div>
    {section === 'team' ? <TeamView currentUserId={currentUserId} embedded profiles={profiles} onUpdate={onUpdateProfile} /> : <SeasonsView embedded memberships={memberships} profiles={profiles} seasons={seasons} onCreate={onCreateSeason} onToggleMembership={onToggleMembership} />}
  </div>
}
