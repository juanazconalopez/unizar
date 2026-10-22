import { test } from '@playwright/test'
import { authorizeFuturePlayer, correctHistoricalDerby } from './helpers/trainingExceptionScenario'
test('corrige el dorsal 17 del derbi y conserva los minutos en móvil', async ({ page }, info) => correctHistoricalDerby(page, info))
test('un entrenador autoriza y convoca desde móvil', async ({ page }) => authorizeFuturePlayer(page))
