import { useState } from 'react'
import { Icon } from '../../components/Icon'
import { formatDate } from '../../lib/dates'
import { parseDriveFolder } from '../../services/libraryService'
import type { LibrarySettings } from '../../types'

export function LibrarySettingsView({ hideEmbeddedTitle = false, settings = null, onSaveFolder, onSync }: {
  hideEmbeddedTitle?: boolean
  settings?: LibrarySettings | null
  onSaveFolder?: (folderUrl: string) => Promise<void>
  onSync?: () => Promise<void>
}) {
  const [folderUrl, setFolderUrl] = useState(settings?.root_folder_url ?? '')
  const [editing, setEditing] = useState(!settings?.root_folder_url)
  const [busy, setBusy] = useState(false)

  async function saveFolder() {
    if (!onSaveFolder || !parseDriveFolder(folderUrl)) return
    setBusy(true)
    try {
      await onSaveFolder(folderUrl)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  async function syncFolder() {
    if (!onSync) return
    setBusy(true)
    try {
      await onSync()
    } finally {
      setBusy(false)
    }
  }

  const hasFolder = Boolean(settings?.root_folder_id || parseDriveFolder(folderUrl))
  const statusLabel = settings?.sync_status === 'succeeded'
    ? 'Sincronizada'
    : settings?.sync_status === 'running'
      ? 'Sincronizando…'
      : settings?.sync_status === 'failed'
        ? 'Error de sincronización'
        : 'Pendiente de sincronizar'
  return (
    <section className="library-settings-panel" aria-label="Ajustes de librería">
      <div className={`settings-section-heading${hideEmbeddedTitle ? ' compact' : ''}`}>
        <div>
          {!hideEmbeddedTitle && <><span className="eyebrow">RECURSOS COMPARTIDOS</span><h2 id="library-settings-title">Librería</h2></>}
          <p>Conecta una carpeta de Google Drive para compartir sus documentos con el equipo.</p>
        </div>
      </div>
      <div className="library-settings-card">
        <label>
          Carpeta compartida
          <input aria-label="Carpeta compartida" onChange={(event) => setFolderUrl(event.target.value)} placeholder="Pega el enlace de la carpeta raíz" readOnly={!editing} value={folderUrl} />
        </label>
        <div className="library-folder-actions">
          {editing ? <>
            <button className="primary-button" disabled={busy || !parseDriveFolder(folderUrl) || !onSaveFolder} onClick={() => void saveFolder()} type="button"><Icon name="save" size={17} />Guardar carpeta</button>
            {settings?.root_folder_url && <button className="secondary-button" disabled={busy} onClick={() => { setFolderUrl(settings.root_folder_url ?? ''); setEditing(false) }} type="button">Cancelar</button>}
          </> : <button className="secondary-button" disabled={busy || !onSaveFolder} onClick={() => setEditing(true)} type="button"><Icon name="edit" size={17} />Cambiar carpeta</button>}
        </div>
        {settings?.root_folder_url && <a className="library-folder-link" href={settings.root_folder_url} rel="noreferrer" target="_blank">Abrir carpeta en Google Drive</a>}
        {settings && <div className="library-sync-meta">
          <span><strong>Estado</strong>{statusLabel}</span>
          <span><strong>Elementos</strong>{settings.item_count}</span>
          <span><strong>Última sincronización</strong>{settings.last_synced_at ? formatDate(settings.last_synced_at.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) : 'Todavía no'}</span>
        </div>}
        {settings?.sync_error && <p className="library-sync-error">{settings.sync_error}</p>}
        <div className="library-sync-placeholder">
          <Icon name="clock" size={16} />
          <span>La aplicación solo guarda el catálogo; los archivos siguen alojados en Google Drive.</span>
        </div>
        <button className="primary-button" disabled={busy || !hasFolder || !onSync || settings?.sync_status === 'running'} onClick={() => void syncFolder()} type="button"><Icon name="refresh" size={17} />{settings?.sync_status === 'running' ? 'Sincronizando…' : 'Sincronizar ahora'}</button>
      </div>
    </section>
  )
}
