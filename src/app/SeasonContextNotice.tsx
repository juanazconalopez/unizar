import { Icon } from '../components/Icon'
import type { Profile, ViewName } from '../types'

export function SeasonContextNotice({ profile, view, onOpenSettings }: {
  profile: Profile
  view: ViewName
  onOpenSettings: () => void
}) {
  const title = profile.is_owner
    ? 'No hay ninguna temporada activa'
    : profile.is_coach
      ? 'No hay una temporada activa para planificar'
      : profile.is_viewer
        ? 'No hay ninguna temporada activa'
        : 'No tienes una temporada activa asignada'
  const text = profile.is_owner
    ? 'Crea una temporada o revisa sus fechas para volver a trabajar con tareas y partidos.'
    : profile.is_coach
      ? 'El owner debe crear una temporada o corregir sus fechas antes de continuar con la planificación.'
      : profile.is_viewer
        ? 'El cuerpo técnico debe crear una temporada o corregir sus fechas para poder consultar la información del equipo.'
        : 'Consulta con el cuerpo técnico para que revise la temporada y tu inscripción.'

  return <div className="season-context-notice" role="status">
    <span><Icon name="warning" size={18} /></span>
    <div><strong>{title}</strong><p>{text}</p></div>
    {profile.is_owner && view !== 'settings' && <button className="secondary-button compact" onClick={onOpenSettings}>Revisar temporadas</button>}
  </div>
}
