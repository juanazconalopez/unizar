import { test } from '@playwright/test'
import { checkTrainingSchedule } from './trainingScheduleScenario'
test('las jugadoras responden al entrenamiento y el viernes registra asistencia automáticamente en móvil', async ({ page }, info) => {
  await checkTrainingSchedule(page, info)
})
