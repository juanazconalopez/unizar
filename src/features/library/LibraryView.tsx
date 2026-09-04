import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from '../../components/Icon'
import { PageHeader } from '../../components/ui/PageHeader'
import { formatDate } from '../../lib/dates'
import type { LibraryItem } from '../../types'

/**
 * Catálogo de metadatos sincronizado desde la carpeta compartida de Drive.
 * Los enlaces mantienen la apertura y descarga en Google, sin pasar archivos
 * por Supabase Storage.
 */
export function LibraryView({ items = [] }: { items?: LibraryItem[] }) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set())
  const childrenByParent = useMemo(() => {
    const map = new Map<string, LibraryItem[]>()
    for (const item of items) {
      const parent = item.parent_drive_id ?? '__root__'
      map.set(parent, [...(map.get(parent) ?? []), item])
    }
    return map
  }, [items])
  const itemIds = useMemo(() => new Set(items.map((item) => item.drive_file_id)), [items])
  const rootItems = useMemo(() => items.filter((item) => !item.parent_drive_id || !itemIds.has(item.parent_drive_id)), [itemIds, items])
  const folders = items.filter((item) => item.is_folder).length

  function toggleFolder(id: string) {
    setOpenFolders((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function renderItems(entries: LibraryItem[], depth = 0): ReactNode {
    return entries.map((item) => {
      const children = childrenByParent.get(item.drive_file_id) ?? []
      const isOpen = openFolders.has(item.drive_file_id)
      if (item.is_folder) return <div className="library-tree-node" key={item.drive_file_id}>
        <button aria-expanded={isOpen} className="library-item library-folder-item" onClick={() => toggleFolder(item.drive_file_id)} style={{ '--library-depth': depth } as CSSProperties} type="button">
          <Icon name="folder" size={22} />
          <span><strong>{item.name}</strong><small>{children.length} {children.length === 1 ? 'elemento' : 'elementos'}</small></span>
          <Icon name="arrow" size={16} />
        </button>
        {isOpen && children.length > 0 && <div className="library-tree-children">{renderItems(children, depth + 1)}</div>}
      </div>
      const openUrl = item.web_view_link ?? item.web_content_link
      const downloadUrl = item.web_content_link ?? item.web_view_link
      return <div className="library-item library-file-item" key={item.drive_file_id} style={{ '--library-depth': depth } as CSSProperties}>
        <Icon name={fileIcon(item.mime_type)} size={21} />
        {openUrl ? <a href={openUrl} rel="noreferrer" target="_blank"><strong>{item.name}</strong><small>{fileMeta(item)}</small></a> : <span><strong>{item.name}</strong><small>{fileMeta(item)}</small></span>}
        {downloadUrl && <a aria-label={`Descargar ${item.name}`} className="library-download" href={downloadUrl} rel="noreferrer" target="_blank"><Icon name="download" size={17} /></a>}
      </div>
    })
  }

  return (
    <section className="page library-page">
      <PageHeader eyebrow="RECURSOS DEL EQUIPO" title="Librería" subtitle="Consulta las carpetas y documentos compartidos del club." />
      {items.length === 0 ? <div className="library-coming-soon empty-state">
        <span><Icon name="folder" /></span>
        <h3>Aún no hay documentos sincronizados</h3>
        <p>El owner debe conectar una carpeta de Google Drive y pulsar Sincronizar para mostrar aquí su contenido.</p>
      </div> : <section aria-label="Contenido de la librería" className="library-browser">
        <div className="library-browser-summary"><strong>{items.length} {items.length === 1 ? 'elemento' : 'elementos'}</strong><span>{folders} {folders === 1 ? 'carpeta' : 'carpetas'}</span></div>
        <div className="library-tree">{renderItems(rootItems)}</div>
      </section>}
    </section>
  )
}

function fileIcon(mimeType: string): 'copy' | 'strategy' | 'calendar' {
  if (mimeType.startsWith('video/')) return 'strategy'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'calendar'
  return 'copy'
}

function fileMeta(item: LibraryItem) {
  const parts = []
  if (item.size_bytes !== null) parts.push(formatBytes(item.size_bytes))
  if (item.modified_at) parts.push(`Modificado ${formatDate(item.modified_at.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}`)
  return parts.join(' · ') || 'Archivo de Google Drive'
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
