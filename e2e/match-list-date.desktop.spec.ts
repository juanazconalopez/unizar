import { test } from '@playwright/test'
import { checkMatchListDates } from './helpers/matchListDateScenario'

test('la lista destaca la fecha a la izquierda y conserva la información y las acciones', async ({ page }, info) => {
  await checkMatchListDates(page, info)
})
