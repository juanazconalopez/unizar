import { useId, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { FatigueIcon } from '../../components/ui/FatigueIcon'
import { Modal } from '../../components/ui/Modal'
import { FATIGUE_LEVELS } from '../../constants/training'
import { formatDate } from '../../lib/dates'
import { isPlayer } from '../../lib/permissions'
import type { Profile, TaskResult, TrainingTask } from '../../types'

export function TaskResultsSummary({ task, results, profiles, eligibleCount }: {
  task: TrainingTask
  results: TaskResult[]
  profiles: Profile[]
  eligibleCount?: number
}) {
  const [open, setOpen] = useState(false)
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const playerResults = results
    .filter((result) => {
      const profile = profileById.get(result.player_id)
      return result.task_id === task.id && (!profile || isPlayer(profile))
    })
    .sort((first, second) => second.performed_on.localeCompare(first.performed_on))
  const average = playerResults.length
    ? playerResults.reduce((total, result) => total + result.fatigue_level, 0) / playerResults.length
    : null

  return (
    <>
      <div className={`task-results-summary${average === null ? ' empty' : ''}`}>
        {average === null ? (
          <span>{eligibleCount === undefined ? 'Sin resultados' : `0/${eligibleCount} respuestas · 0%`}</span>
        ) : (
          <span>
            <FatigueIcon level={Math.round(average)} size={19} />
            Fatiga media <strong>{average.toFixed(1)}/5</strong>
            <small>
              {eligibleCount === undefined
                ? `${playerResults.length} ${playerResults.length === 1 ? 'respuesta' : 'respuestas'}`
                : `${playerResults.length}/${eligibleCount} respuestas · ${eligibleCount ? Math.round((playerResults.length / eligibleCount) * 100) : 0}%`}
            </small>
          </span>
        )}
        {playerResults.length > 0 && (
          <button className="secondary-button compact" onClick={() => setOpen(true)} type="button">Ver resultados</button>
        )}
      </div>
      {open && <TaskResultsDialog onClose={() => setOpen(false)} profiles={profiles} results={results} task={task} />}
    </>
  )
}

export function TaskResultsDialog({ task, results, profiles, onClose }: {
  task: TrainingTask
  results: TaskResult[]
  profiles: Profile[]
  onClose: () => void
}) {
  const titleId = useId()
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const playerResults = results
    .filter((result) => {
      const profile = profileById.get(result.player_id)
      return result.task_id === task.id && (!profile || isPlayer(profile))
    })
    .sort((first, second) => second.performed_on.localeCompare(first.performed_on))
  const average = playerResults.reduce((total, result) => total + result.fatigue_level, 0) / playerResults.length
  return <Modal className="task-results-dialog" labelledBy={titleId} onClose={onClose}>
            <div className="task-detail-heading">
              <div>
                <span className="eyebrow">RESULTADOS · {playerResults.length} {playerResults.length === 1 ? 'JUGADORA' : 'JUGADORAS'}</span>
                <h2 id={titleId}>{task.title}</h2>
              </div>
              <button aria-label="Cerrar resultados" className="icon-button" onClick={onClose} type="button">×</button>
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
      </Modal>
}
