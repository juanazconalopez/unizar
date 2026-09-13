import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { Icon } from '../../components/Icon'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { COMPETITION_PALETTE, competitionsForSeason, paletteEntry } from '../../lib/seasonCompetitions'
import type { Season, SeasonCompetition, SeasonCompetitionColor } from '../../types'
import type { SeasonCompetitionValues } from '../../services/seasonCompetitionsService'

export function SeasonCompetitionsDialog({ competitions, season, onClose, onCreate, onDelete, onSetDefault, onUpdate }: {
  competitions: SeasonCompetition[]
  season: Season
  onClose: () => void
  onCreate: (season: Season, values: SeasonCompetitionValues) => Promise<void>
  onDelete: (competition: SeasonCompetition) => Promise<void>
  onSetDefault: (competition: SeasonCompetition) => Promise<void>
  onUpdate: (competition: SeasonCompetition, values: SeasonCompetitionValues) => Promise<void>
}) {
  const titleId = useId()
  const seasonCompetitions = competitionsForSeason(competitions, season.id)
  const [editing, setEditing] = useState<SeasonCompetition | null | undefined>(undefined)
  const [selectedColor, setSelectedColor] = useState<SeasonCompetitionColor>('purple')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openEditor(competition: SeasonCompetition | null) {
    const firstFreeColor = COMPETITION_PALETTE.find((color) => !seasonCompetitions.some((item) => item.color === color.key))?.key ?? 'purple'
    setSelectedColor(competition?.color ?? firstFreeColor)
    setEditing(competition)
    setError('')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editing === undefined) return
    const form = new FormData(event.currentTarget)
    const values = { name: String(form.get('name')), color: selectedColor }
    setSaving(true); setError('')
    try {
      if (editing) await onUpdate(editing, values)
      else await onCreate(season, values)
      setEditing(undefined)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  async function setDefault(competition: SeasonCompetition) {
    setSaving(true); setError('')
    try { await onSetDefault(competition) } catch (caught) { setError(errorText(caught)) } finally { setSaving(false) }
  }

  async function remove(competition: SeasonCompetition) {
    const matchCount = competition.match_count ?? 0
    const message = `¿Eliminar “${competition.name}”?\n\nSe eliminarán ${matchCount} ${matchCount === 1 ? 'partido' : 'partidos'} y todas sus disponibilidades, convocatorias e historial. Esta acción no se puede deshacer.`
    if (!window.confirm(message)) return
    setSaving(true); setError('')
    try { await onDelete(competition) } catch (caught) { setError(errorText(caught)) } finally { setSaving(false) }
  }

  return <Modal className="season-competitions-dialog" disabled={saving} labelledBy={titleId} onClose={onClose} onSubmit={editing !== undefined ? submit : undefined}>
    <div className="panel-form-heading">
      <div><span className="eyebrow">{season.name}</span><h2 id={titleId}>Competiciones</h2></div>
      <button aria-label="Cerrar" className="icon-button" onClick={onClose} type="button">×</button>
    </div>

    {editing === undefined ? <>
      <div className="season-competition-list">
        {seasonCompetitions.map((competition) => {
          const color = paletteEntry(competition.color)
          return <article className="season-competition-row" key={competition.id}>
            <i aria-hidden="true" style={{ backgroundColor: color.solid }} />
            <div><strong>{competition.name}</strong><span>{competition.match_count ?? 0} {(competition.match_count ?? 0) === 1 ? 'partido' : 'partidos'}</span></div>
            {competition.is_default ? <span className="competition-default-label">Predeterminada</span> : <button className="text-button" disabled={saving} onClick={() => void setDefault(competition)} type="button">Hacer predeterminada</button>}
            <button aria-label={`Editar ${competition.name}`} className="secondary-button compact" disabled={saving} onClick={() => openEditor(competition)} type="button">Editar</button>
            <button aria-label={`Eliminar ${competition.name}`} className="danger-button compact" disabled={saving} onClick={() => void remove(competition)} type="button">Eliminar</button>
          </article>
        })}
        {!seasonCompetitions.length && <div className="empty-state compact"><span><Icon name="trophy" /></span><h3>Sin competiciones</h3><p>Crea la primera competición de la temporada. Se marcará como predeterminada.</p></div>}
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cerrar</button><button className="primary-button" disabled={saving || seasonCompetitions.length >= COMPETITION_PALETTE.length} onClick={() => openEditor(null)} type="button"><Icon name="plus" size={17} />Nueva competición</button></div>
      {seasonCompetitions.length >= COMPETITION_PALETTE.length && <p className="form-hint">Ya se están utilizando todos los colores disponibles en esta temporada.</p>}
    </> : <>
      <div className="form-grid">
        <label className="full-field">Nombre<input autoFocus defaultValue={editing?.name ?? ''} maxLength={80} name="name" placeholder="Ej. Copa Aragón" required /></label>
        <fieldset className="competition-color-field full-field"><legend>Color</legend><div className="competition-color-palette">
          {COMPETITION_PALETTE.map((color) => {
            const unavailable = seasonCompetitions.some((item) => item.color === color.key && item.id !== editing?.id)
            return <label className={unavailable ? 'unavailable' : ''} key={color.key} title={unavailable ? `${color.label} ya está en uso` : color.label}>
              <input checked={selectedColor === color.key} disabled={unavailable} name="color" onChange={() => setSelectedColor(color.key)} type="radio" value={color.key} />
              <span style={{ backgroundColor: color.solid }} /><small>{color.label}</small>
            </label>
          })}
        </div></fieldset>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setEditing(undefined)} type="button">Cancelar</button><button className="primary-button" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear competición'}</button></div>
    </>}
  </Modal>
}
