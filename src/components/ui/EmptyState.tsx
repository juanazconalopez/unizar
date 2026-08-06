import { Icon } from '../Icon'

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <span><Icon name="calendar" /></span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}
