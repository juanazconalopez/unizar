import { test } from '@playwright/test'
import { checkPastedTrainingImage } from './trainingImagesScenario'

test('pasted exercise image survives saving and reopening the training with its formatted description', async ({ page }) => {
  await checkPastedTrainingImage(page)
})
