import { saveLibraryFolder, syncLibrary } from '../../services/libraryService'
import type { ActionContext } from './actionContext'

export function createLibraryActions(context: ActionContext) {
  return {
    saveFolder: async (folderUrl: string) => {
      try {
        context.requireConnection()
        await saveLibraryFolder(folderUrl)
        context.notify('Carpeta de la librería guardada.')
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
        throw error
      }
    },
    sync: async () => {
      try {
        context.requireConnection()
        const result = await syncLibrary()
        context.notify(`Librería sincronizada: ${result.itemCount} elementos.`)
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
        throw error
      }
    },
  }
}

export type LibraryActions = ReturnType<typeof createLibraryActions>
