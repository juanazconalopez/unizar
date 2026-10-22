import { expect, type Page, type TestInfo } from '@playwright/test'

export async function checkMatchListDates(page: Page, info: TestInfo) {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Partidos', exact: true }).click()
  await page.getByRole('button', { name: 'Mes siguiente', exact: true }).click()
  await page.getByRole('button', { name: /^8 de octubre:/ }).click()
  const calendarCard = page.locator('.selected-planning-week .match-card').filter({ hasText: 'Quebrantahuesos Rugby' })
  await expect(calendarCard).toBeVisible()
  await expect(calendarCard.locator('.match-card-date')).toHaveCount(0)
  const content = await calendarCard.locator('.match-card-copy').textContent() ?? ''
  const availability = await calendarCard.locator('.availability-summary').textContent() ?? ''
  const color = await calendarCard.evaluate((element) => getComputedStyle(element).borderLeftColor)

  await page.getByRole('button', { name: 'Vista de lista', exact: true }).click()
  const cards = page.locator('.match-week-list .match-card')
  await expect(page.locator('.match-week-list .match-card-date')).toHaveCount(await cards.count())
  const card = cards.filter({ hasText: 'Quebrantahuesos Rugby' })
  const date = card.locator('.match-card-date')
  const copy = card.locator('.match-card-copy')
  await expect(date).toHaveAttribute('datetime', '2026-10-08')
  await expect(date.locator('span')).toHaveText(/oct\.?/i)
  await expect(date.locator('strong')).toHaveText('8')
  await expect(copy).toHaveText(content)
  await expect(card.locator('.availability-summary')).toHaveText(availability)
  await expect(card).toHaveCSS('border-left-color', color)

  const viewport = page.viewportSize()!
  const widths = viewport.width <= 680 ? [viewport.width, 320] : [viewport.width]
  for (const width of widths) {
    await page.setViewportSize({ width, height: viewport.height })
    await card.scrollIntoViewIfNeeded()
    const dateBox = (await date.boundingBox())!, copyBox = (await copy.boundingBox())!
    expect(dateBox.x + dateBox.width).toBeLessThanOrEqual(copyBox.x)
    expect(await card.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await card.screenshot({ path: `/tmp/unizar-match-list-date-${info.project.name}-${width}.png` })
  }
  await page.setViewportSize(viewport)
  await date.click()
  const detail = page.getByRole('dialog')
  await expect(detail.locator('.match-detail-date')).toContainText('8 de octubre de 2026')
  await expect(detail).toContainText('Partido amistoso de preparación.')
  await detail.getByRole('button', { name: 'Cerrar', exact: true }).click()
  await page.getByRole('button', { name: 'Vista calendario', exact: true }).click()
  await expect(page.locator('.match-card-date')).toHaveCount(0)
}
