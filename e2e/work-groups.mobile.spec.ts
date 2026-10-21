import { test } from '@playwright/test'
import { checkWorkGroups } from './workGroups'

test('organiza grupos de trabajo y vídeo análisis en móvil', async ({ page }, testInfo) => {
  await checkWorkGroups(page, testInfo)
})
