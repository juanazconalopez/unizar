import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../../components/ui/Avatar'
import { FatigueIcon } from '../../components/ui/FatigueIcon'
import { FATIGUE_LEVELS } from '../../constants/training'
import { formatDate } from '../../lib/dates'
import type { Profile, TaskResult, TrainingTask } from '../../types'

export function TaskResultsSummary({ task, results, profiles }: {
  task: TrainingTask
  results: TaskResult[]
  profiles: Profile[]
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const playerResults = results
    .filter((result) => result.task_id === task.id && !profileById.get(result.player_id)?.is_owner)
    .sort((first, second) => second.performed_on.localeCompare(first.performed_on))
  const average = playerResults.length
    ? playerResults.reduce((total, result) => total + result.fatigue_level, 0) / playerResults.length
    : null

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <>
      <div className={`task-results-summary${average === null ? ' empty' : ''}`}>
        {average === null ? (
          <span>Sin resultados</span>
        ) : (
          <span>
            <FatigueIcon level={Math.round(average)} size={19} />
            Fatiga media <strong>{average.toFixed(1)}/5</strong>
            <small>{playerResults.length} {playerResults.length === 1 ? 'respuesta' : 'respuestas'}</small>
          </span>
        )}
        {playerResults.length > 0 && (
          <button className="secondary-button compact" onClick={() => setOpen(true)} type="button">Ver resultados</button>
        )}
      </div>
      {open && createPortal(
        <div className="task-detail-backdrop" onClick={() => setOpen(false)}>
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            className="task-detail-dialog task-results-dialog"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="task-detail-heading">
              <div>
                <span className="eyebrow">RESULTADOS · {playerResults.length} {playerResults.length === 1 ? 'JUGADORA' : 'JUGADORAS'}</span>
                <h2 id={titleId}>{task.title}</h2>
              </div>
              <button aria-label="Cerrar resultados" className="icon-button" onClick={() => setOpen(false)} type="button">×</button>
            </div>
            <div className="task-results-average">
              <FatigueIcon level={Math.round(average ?? 3)} size={30} />
              <span>Fatiga media del equipo<strong>{average?.toFixed(1)}/5</strong></span>
            </div>
            <div className="task-result-list">
              {playerResults.map((result) => {
                const profile = profileById.get(result.player_id)
                const name = profile?.display_name ?? 'Jugadora'
                const fatigue = FATIGUE_LEVELS.find((level) => level.value === result.fatigue_level)
                return (
                  <article className="task-result-item" key={result.player_id}>
                    <Avatar name={name} />
                    <div>
                      <div className="task-result-player">
                        <span><strong>{name}</strong><small>{formatDate(result.performed_on, { day: 'numeric', month: 'long' })}</small></span>
                        <span className="task-result-fatigue"><FatigueIcon level={result.fatigue_level} size={20} />{fatigue?.label} · {result.fatigue_level}/5</span>
                      </div>
                      <p>{result.result_text}</p>
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  )
}
