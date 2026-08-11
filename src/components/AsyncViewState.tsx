import { Component } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function SectionLoading() {
  return (
    <div aria-label="Cargando sección" className="section-state" role="status">
      <div aria-hidden="true" className="section-skeleton">
        <i /><i /><span /><span /><span />
      </div>
      <p className="sr-only">Cargando sección…</p>
    </div>
  )
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="section-state error-state">
      <span><Icon name="warning" size={24} /></span>
      <h2>No hemos podido cargar esta sección</h2>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry} type="button">Reintentar</button>
    </div>
  )
}

export class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    // The recovery action deliberately reloads so a stale PWA can obtain the latest chunk map.
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="section-state error-state">
          <span><Icon name="warning" size={24} /></span>
          <h2>La sección necesita actualizarse</h2>
          <p>Puede haber una versión nueva de la aplicación disponible.</p>
          <button className="primary-button" onClick={() => window.location.reload()} type="button">Actualizar y reintentar</button>
        </div>
      )
    }
    return this.props.children
  }
}
