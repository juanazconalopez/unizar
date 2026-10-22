import { test } from '@playwright/test'
import { checkFirstDoubtResponse } from './helpers/availabilityResponseScenario'

test('responde directamente en duda con comentario y botones accesibles en móvil', async ({ page }, info) => {
  await checkFirstDoubtResponse(page, info)
})
