import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
import type { LibraryItem } from '../../types'
import { LibraryView } from './LibraryView'

const folder: LibraryItem = {
  drive_file_id: 'folder-1', parent_drive_id: 'root-folder', name: 'Documentos', mime_type: 'application/vnd.google-apps.folder',
  size_bytes: null, modified_at: null, web_view_link: 'https://drive.google.com/drive/folders/folder-1', web_content_link: null,
  resource_key: null, is_folder: true, synced_at: '2026-09-04T10:00:00Z',
}

const documentItem: LibraryItem = {
  drive_file_id: 'file-1', parent_drive_id: 'folder-1', name: 'Reglamento.pdf', mime_type: 'application/pdf',
  size_bytes: 2048, modified_at: '2026-09-03T10:00:00Z', web_view_link: 'https://drive.google.com/file/d/file-1/view', web_content_link: 'https://drive.google.com/uc?id=file-1',
  resource_key: null, is_folder: false, synced_at: '2026-09-04T10:00:00Z',
}

describe('LibraryView', () => {
  test('shows a synchronized tree and reveals folder contents on demand', async () => {
    const user = userEvent.setup()
    render(<LibraryView items={[folder, documentItem]} />)

    expect(screen.getByText('Documentos')).toBeInTheDocument()
    expect(screen.queryByText('Reglamento.pdf')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Documentos/ }))
    expect(screen.getByText('Reglamento.pdf').closest('a')).toHaveAttribute('href', documentItem.web_view_link)
    expect(screen.getByRole('link', { name: 'Descargar Reglamento.pdf' })).toHaveAttribute('href', documentItem.web_content_link)
  })
})
