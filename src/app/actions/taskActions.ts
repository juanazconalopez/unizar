import { createTrainingTask, deleteTrainingTask, reorderTrainingTasks, saveTaskResult, updateTrainingTask, updateTaskStatus } from '../../services/tasksService'
import type { ResultValues, TaskResult, TaskStatus, TaskValues, TrainingTask } from '../../types'
import type { ActionContext } from './actionContext'

export function createTaskActions(context: ActionContext, results: TaskResult[]) {
  return {
    saveResult: async (task: TrainingTask, values: ResultValues) => {
      context.requireConnection()
      if (!context.userId) return
      const exists = results.some((result) => result.task_id === task.id && result.player_id === context.userId)
      await saveTaskResult(task, values, context.userId, exists)
      context.notify(exists ? 'Resultado actualizado.' : 'Entrenamiento completado. ¡Buen trabajo!')
      await context.reloadData()
    },
    create: async (values: TaskValues) => {
      context.requireConnection()
      if (!context.userId) return
      await createTrainingTask(values, context.userId)
      context.notify(values.status === 'published' ? 'Tarea creada y publicada.' : 'Borrador guardado.')
      await context.reloadData()
    },
    changeStatus: async (taskId: string, status: TaskStatus) => {
      try {
        context.requireConnection()
        await updateTaskStatus(taskId, status)
        context.notify(status === 'published' ? 'Tarea publicada.' : 'Estado de la tarea actualizado.')
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
      }
    },
    reorder: async (taskIds: string[]) => {
      try {
        context.requireConnection()
        await reorderTrainingTasks(taskIds)
        context.notify('Orden de las tareas actualizado.')
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
      }
    },
    update: async (task: TrainingTask, values: TaskValues) => {
      try {
        context.requireConnection()
        await updateTrainingTask(task.id, values)
        context.notify('Tarea actualizada.')
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
        throw error
      }
    },
    delete: async (task: TrainingTask) => {
      try {
        context.requireConnection()
        await deleteTrainingTask(task.id)
        context.notify('Tarea y respuestas eliminadas.')
        await context.reloadData()
      } catch (error) {
        context.reportError(error)
        throw error
      }
    },
  }
}

export type TaskActions = ReturnType<typeof createTaskActions>
