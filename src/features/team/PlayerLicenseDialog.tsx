import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { licenseAllowsTeam, membershipLicense, PLAYER_LICENSES } from '../../lib/playerLicenses'
import type { PlayerLicenseType, Profile, Season, SeasonPlayer } from '../../types'

export type SavePlayerLicense = (season: Season, player: Profile, license: PlayerLicenseType) => Promise<void>

export function PlayerLicenseDialog({ person, season, membership, onSave, onClose }: {
  person: Profile; season: Season; membership: SeasonPlayer; onSave: SavePlayerLicense; onClose: () => void
}) {
  const [license, setLicense] = useState(membershipLicense(membership))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const titleId = 'player-license-dialog-title'

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(season, person, license)
      onClose()
    } catch (cause) {
      setError(errorText(cause))
      setSaving(false)
    }
  }

  return <Modal className="player-license-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={save}>
    <div className="task-detail-heading"><div><span className="eyebrow">{person.display_name}</span><h2 id={titleId}>Modificar ficha</h2></div></div>
    <section aria-label="Ficha de jugadora" className="player-license-panel">
      <h3>Ficha de jugadora</h3>
      <label>Temporada activa<input className="readonly-field" readOnly value={season.name} /></label>
      <label>Tipo de ficha<select autoFocus disabled={saving} onChange={(event) => setLicense(event.target.value as PlayerLicenseType)} value={license}>{PLAYER_LICENSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      {!licenseAllowsTeam(license) && <p className="form-hint">Sin equipo. Puede participar en amistosos y registrar presencias y ausencias en entrenamientos.</p>}
      <p className="form-hint">El equipo se gestiona en Temporadas → Equipos. El cambio de ficha se aplica al guardar y conserva el histórico.</p>
      <p>Titularidades en liga nacional: <strong>{membership.national_starts ?? 0}/6</strong>{(membership.national_starts ?? 0) >= 6 && ' · No puede jugar partidos regionales durante esta temporada.'}</p>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={onClose} type="button">Cancelar</button><button className="primary-button" disabled={saving || license === membershipLicense(membership)}>{saving ? 'Guardando…' : 'Guardar'}</button></div>
  </Modal>
}
