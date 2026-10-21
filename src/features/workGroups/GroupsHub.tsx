import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import type { ViewName } from '../../types'

export function GroupsHub({ onNavigate, training, work, video }: { onNavigate: (view: ViewName) => void; training: boolean; work: boolean; video: boolean }) {
  const cards = [
    { view: 'training-groups' as const, visible: training, icon: 'users' as const, label: 'Grupos de entrenamiento', text: 'Rojo y Blanco. Consulta y prepara el reparto para entrenar juntas.', detail: 'EL EQUIPO EN EL CAMPO', color: 'training' },
    { view: 'work-groups' as const, visible: work, icon: 'tasks' as const, label: 'Grupos de trabajo', text: 'Cada persona cuenta. Organiza las responsabilidades que hacen equipo.', detail: 'EL EQUIPO FUERA DEL CAMPO', color: 'work' },
    { view: 'video-analysis' as const, visible: video, icon: 'video' as const, label: 'Asignación de vídeo análisis', text: 'Un partido, un grupo responsable. Un reparto que sigue el calendario real.', detail: 'APRENDER DE CADA PARTIDO', color: 'video' },
  ]
  return <div className="page groups-page"><PageHeader eyebrow="GESTIÓN · EQUIPO" title="Grupos" subtitle="Dentro y fuera del campo, nos organizamos juntas." />
    <div className="groups-hub">{cards.filter((card) => card.visible).map((card) => <button type="button" key={card.view} className={`groups-hub-card ${card.color}`} onClick={() => onNavigate(card.view)}>
      <span className="groups-hub-icon"><Icon name={card.icon} size={28} /></span><span className="eyebrow">{card.detail}</span><h2>{card.label}</h2><p>{card.text}</p><span className="groups-hub-link">Abrir sección <Icon name="arrow" size={17} /></span>
    </button>)}</div>
  </div>
}
