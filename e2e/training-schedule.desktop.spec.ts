import { test } from '@playwright/test'
import { checkTrainingSchedule } from './trainingScheduleScenario'
test('genera la agenda y conserva respuestas y asistencia real', async ({ page }, info) => {
  await checkTrainingSchedule(page, info)
})
