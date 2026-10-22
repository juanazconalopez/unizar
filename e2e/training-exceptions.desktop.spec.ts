import { test } from '@playwright/test'
import { authorizeFuturePlayer, correctHistoricalDerby } from './helpers/trainingExceptionScenario'
test('corrige el dorsal 17 del derbi y conserva los minutos al reabrir', async ({ page }, info) => correctHistoricalDerby(page, info))
test('un entrenador autoriza y convoca a una jugadora de solo entrenamientos', async ({ page }) => authorizeFuturePlayer(page))
