import { test } from '@playwright/test'
import { checkFirstDoubtResponse } from './helpers/availabilityResponseScenario'

test('responde directamente en duda con comentario desde el detalle del partido', async ({ page }, info) => {
  await checkFirstDoubtResponse(page, info)
})
