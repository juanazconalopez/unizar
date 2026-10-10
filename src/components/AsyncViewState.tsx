import { Component } from 'react'
import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { isAppAssetLoadError, reloadApp } from '../lib/appRecovery'

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

export class ViewErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean; assetError: boolean }> {
  state = { failed: false, assetError: false }

  static getDerivedStateFromError(error: unknown) {
    return { failed: true, assetError: isAppAssetLoadError(error) }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="section-state error-state">
          <span><Icon name="warning" size={24} /></span>
          <h2>{this.state.assetError ? 'La sección necesita actualizarse' : 'No hemos podido abrir esta pantalla'}</h2>
          <p>{this.state.assetError ? 'Comprueba tu conexión y actualiza para cargar la versión actual.' : 'Vuelve a intentarlo. Si el problema continúa, comprueba tu conexión.'}</p>
          <button className="primary-button" onClick={() => this.state.assetError ? void reloadApp() : window.location.reload()} type="button">
            {this.state.assetError ? 'Actualizar y reintentar' : 'Reintentar'}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
