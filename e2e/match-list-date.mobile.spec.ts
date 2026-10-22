import { test } from '@playwright/test'
import { checkMatchListDates } from './helpers/matchListDateScenario'

test('la fecha de la lista permanece a la izquierda sin desbordamiento en móvil', async ({ page }, info) => {
  await checkMatchListDates(page, info)
})
