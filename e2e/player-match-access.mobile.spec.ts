import { test } from '@playwright/test'
import { checkPlayerMatchAccess } from './player-match-access'

test('todas las fichas ven partidos de otros equipos, solo las deportivas responden', async ({ page }, info) => {
  await checkPlayerMatchAccess(page, info.project.name)
})
