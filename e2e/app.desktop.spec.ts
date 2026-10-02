import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

test('desktop keeps the sidebar and content layout usable', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  const content = page.locator('.content')
  await expect(sidebar).toBeVisible()
  await expect(page.locator('.mobile-nav')).toBeHidden()

  const sidebarBox = await sidebar.boundingBox()
  const contentBox = await content.boundingBox()
  expect(sidebarBox).not.toBeNull()
  expect(contentBox).not.toBeNull()
  expect(contentBox!.x).toBeGreaterThanOrEqual(sidebarBox!.x + sidebarBox!.width)

  await sidebar.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await expect(page.getByRole('heading', { name: 'Encuestas', exact: true })).toBeVisible()
})

test('owner home emphasizes response counts ahead of fatigue', async ({ page }) => {
  await page.goto('/')
  const summary = page.locator('.task-results-summary').first()
  await expect(summary).toBeVisible()
  const count = summary.locator(':scope > span > strong')
  const secondary = summary.locator(':scope > span > small')
  await expect(count).toHaveText(/^[0-9]+\/[0-9]+$/)
  await expect(secondary).toContainText('Fatiga media')
  const sizes = await summary.evaluate((element) => ({
    count: Number.parseFloat(getComputedStyle(element.querySelector('strong')!).fontSize),
    secondary: Number.parseFloat(getComputedStyle(element.querySelector('small')!).fontSize),
  }))
  expect(sizes.count).toBeGreaterThan(sizes.secondary)

  await page.setViewportSize({ width: 390, height: 844 })
  const box = await summary.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
})

test('calendar task cards show responses before fatigue', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Calendario' }).click()
  const summary = page.locator('.selected-week-tasks .task-results-summary').filter({ hasText: 'Fatiga media' }).first()
  await expect(summary).toBeVisible()
  await expect(summary.locator(':scope > span > strong')).toHaveText(/^[0-9]+$/)
  await expect(summary.locator(':scope > span > small')).toContainText('Fatiga media')
  await expect(summary.locator(':scope > span > small')).not.toContainText('respuestas')

  await page.setViewportSize({ width: 390, height: 844 })
  const box = await summary.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x + box!.width).toBeLessThanOrEqual(390)
})

test('desktop shows up to three season rosters per row', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Temporadas' }).click()
  await page.locator('.season-card').first().getByRole('button', { name: 'Gestionar equipos' }).click()

  const dialog = page.getByRole('dialog', { name: 'Equipos' })
  const cards = dialog.locator('.season-team-roster-card')
  const roster = dialog.getByRole('region', { name: /Unizar Femenino, \d+ jugadoras/ })
  await expect(roster.getByLabel('1 jugadora de baja deportiva hoy')).toBeVisible()
  await expect(dialog.getByRole('region', { name: 'Equipo de desarrollo, 0 jugadoras' }).locator('.season-team-absence-count')).toHaveCount(0)
  await expect(roster.locator('.season-team-player').filter({ hasText: 'Sara Jiménez' }).getByRole('img', { name: 'Baja deportiva' })).toBeVisible()
  await page.screenshot({ path: '/tmp/unizar-season-injuries-desktop.png', fullPage: true })
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  const firstTwo = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstTwo).toHaveLength(2)
  expect(firstTwo[1].x).toBeGreaterThan(firstTwo[0].right - 1)
  expect(Math.abs(firstTwo[1].y - firstTwo[0].y)).toBeLessThan(2)

  async function addTeam(name: string) {
    await dialog.getByRole('button', { name: 'Nuevo equipo' }).click()
    await dialog.getByLabel('Nombre').fill(name)
    await dialog.getByRole('button', { name: 'Guardar equipo' }).click()
    await expect(dialog.getByRole('region', { name: `${name}, 0 jugadoras` })).toBeVisible()
  }

  await addTeam('Unizar C')
  const firstThree = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstThree).toHaveLength(3)
  expect(firstThree[2].x).toBeGreaterThan(firstThree[1].right - 1)
  expect(Math.abs(firstThree[2].y - firstThree[0].y)).toBeLessThan(2)

  await addTeam('Unizar D')
  const firstFour = await cards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().toJSON()))
  expect(firstFour).toHaveLength(4)
  expect(Math.abs(firstFour[3].x - firstFour[0].x)).toBeLessThan(2)
  expect(firstFour[3].y).toBeGreaterThan(firstFour[0].bottom - 1)

  await dialog.getByRole('button', { name: 'Editar equipo Unizar C' }).click()
  for (const name of ['Grupo mixto', 'Equipo activo']) {
    const checkbox = dialog.getByRole('checkbox', { name })
    const checkboxBox = await checkbox.boundingBox()
    const labelBox = await checkbox.locator('..').boundingBox()
    expect(checkboxBox).not.toBeNull()
    expect(labelBox).not.toBeNull()
    expect(checkboxBox!.width).toBeLessThanOrEqual(20)
    expect(labelBox!.width).toBeLessThan(150)
    expect(checkboxBox!.x - labelBox!.x).toBeLessThan(2)
  }
})

test('published match detail embeds the graphic and keeps availability and copy actions', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Vista de lista' }).click()
  await page.getByRole('button', { name: 'Ver detalle de Unizar Fem. vs Ingenieros Industriales' }).click()

  const dialog = page.getByRole('dialog', { name: 'Unizar Fem. vs Ingenieros Industriales' })
  const graphic = dialog.getByRole('img', { name: 'Imagen de la convocatoria' })
  await expect(graphic).toBeVisible()
  const embeddedWidth = (await graphic.boundingBox())?.width ?? 0
  await expect(graphic).toContainText('Unizar Fem. vs Ingenieros Industriales')
  await expect(graphic).not.toContainText('CONVOCATORIA · XV')
  await expect(dialog.getByRole('button', { name: 'Ver disponibilidades' })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Copiar convocatoria' })).toBeVisible()
  await expect(dialog.getByRole('heading', { name: 'Titulares' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Ver lista' }).click()
  await expect(dialog.getByRole('heading', { name: 'Titulares' })).toBeVisible()
  const startersHeight = (await dialog.getByRole('heading', { name: 'Titulares' }).locator('..').boundingBox())?.height ?? 0
  const substitutesHeight = (await dialog.getByRole('heading', { name: 'Suplentes' }).locator('..').boundingBox())?.height ?? 0
  expect(substitutesHeight).toBeLessThan(startersHeight - 20)
  await expect(graphic).toBeHidden()
  await expect(dialog.getByRole('button', { name: 'Copiar convocatoria' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Ver imagen' }).click()
  await expect(graphic).toBeVisible()
  await expect(dialog.locator('.match-lineup-view-panel[data-view="image"]')).toHaveCSS('animation-name', 'match-lineup-view-enter')
  await expect(dialog.getByRole('button', { name: 'Ampliar imagen', exact: true })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Ampliar imagen de la convocatoria' }).click()
  const zoomDialog = page.getByRole('dialog', { name: 'Vista gráfica' })
  const expandedWidth = (await zoomDialog.getByRole('img', { name: 'Imagen de la convocatoria' }).boundingBox())?.width ?? 0
  expect(expandedWidth).toBeGreaterThan(embeddedWidth * 1.5)
  await zoomDialog.getByRole('button', { name: 'Aumentar zoom' }).click()
  await expect(zoomDialog.getByRole('button', { name: 'Restablecer zoom' })).toHaveText('150 %')
})

test('owner previews and downloads a graphic lineup in the local demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Ver ejemplo gráfico XV' }).click()

  const dialog = page.getByRole('dialog', { name: 'Vista gráfica' })
  const graphic = dialog.getByRole('img', { name: 'Imagen de la convocatoria' })
  await expect(graphic).toBeVisible()
  await expect(graphic.locator('image')).toHaveCount(6)
  await expect(graphic).toContainText('ENTRENADORES')
  await expect(graphic).toContainText('Andrea López')
  await expect(graphic).toContainText('Lucía Martín')
  const numbers = await graphic.evaluate((element) => {
    const labels = [...element.querySelectorAll('text')]
    return Object.fromEntries(['11', '14', '15'].map((number) => {
      const label = labels.find((item) => item.textContent === number)
      const box = label?.getBoundingClientRect()
      return [number, box ? { x: box.x, y: box.y } : null]
    }))
  })
  expect(numbers['11']?.x).toBeLessThan(numbers['15']?.x ?? 0)
  expect(numbers['14']?.x).toBeGreaterThan(numbers['15']?.x ?? 0)
  expect(numbers['15']?.y).toBeGreaterThan(numbers['11']?.y ?? 0)
  await dialog.getByRole('button', { name: 'Aumentar zoom' }).click()
  const downloadButton = dialog.getByRole('button', { name: 'Descargar PNG' })
  await expect(downloadButton).toBeEnabled()
  const downloadPromise = page.waitForEvent('download')
  await downloadButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^convocatoria-.*\.png$/)
  const png = await readFile(await download.path())
  expect(png.readUInt32BE(16)).toBe(1080)
})

test('the 7s graphic follows the diagonal formation on the same field', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Partidos' }).click()
  await page.getByRole('button', { name: 'Ver ejemplo gráfico 7s' }).click()

  const graphic = page.getByRole('dialog', { name: 'Vista gráfica' }).getByRole('img', { name: 'Imagen de la convocatoria' })
  const points = await graphic.evaluate((element) => Object.fromEntries(Array.from({ length: 7 }, (_, index) => {
    const number = String(index + 1)
    const label = [...element.querySelectorAll('text')].find((item) => item.textContent === number)
    const box = label?.getBoundingClientRect()
    return [number, box ? { x: box.x, y: box.y } : null]
  })))
  expect(points['1']).not.toBeNull()
  expect(points['3']?.y).toBe(points['1']?.y)
  expect(points['1']?.x).toBeLessThan(points['2']?.x ?? 0)
  expect(points['2']?.x).toBeLessThan(points['3']?.x ?? 0)
  expect(points['2']?.y).toBeGreaterThan(points['1']?.y ?? 0)
  for (const number of [4, 5, 6, 7]) {
    expect(points[String(number)]?.x).toBeGreaterThan(points[String(number - 1)]?.x ?? 0)
    expect(points[String(number)]?.y).toBeGreaterThan(points[String(number - 1)]?.y ?? 0)
  }
  await expect(graphic).toContainText('SUPLENTES')
})

test('desktop player profile keeps its actions menu inside the dialog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()

  const dialog = page.getByRole('dialog', { name: 'Claudia Pérez' })
  await dialog.getByRole('button', { name: 'Acciones de Claudia Pérez' }).click()
  const menu = dialog.locator('.team-member-actions-menu')
  await expect(menu.getByRole('button', { name: 'Editar datos' })).toBeVisible()
  await expect(menu.getByRole('button', { name: 'Cambiar foto' })).toBeVisible()
  const dialogBox = await dialog.boundingBox()
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(dialogBox).not.toBeNull()
  expect(menuBox!.x).toBeGreaterThanOrEqual(dialogBox!.x)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width)
  await menu.getByRole('button', { name: 'Editar datos' }).click()
  await expect(dialog.getByLabel('Seleccionar fotografía')).toHaveCount(0)
  await expect(dialog.locator('.team-member-profile-summary')).toHaveCount(0)
})

test('team rows keep contact and indicator columns aligned', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()

  const names = ['Claudia Pérez', 'Marta Sánchez', 'Sara Jiménez']
  const rows = names.map((name) => page.getByRole('button', { name: `Ver datos de ${name}` }))
  await expect(rows[0].getByText('Faltan datos')).toHaveCount(0)
  await expect(rows[1].getByText('Faltan datos')).toBeVisible()
  await expect(rows[2].getByRole('img', { name: 'Baja deportiva' })).toBeVisible()

  const positions = await Promise.all(rows.map((row) => row.evaluate((element) => {
    const x = (selector: string) => element.querySelector(selector)!.getBoundingClientRect().x
    return {
      email: x('.person-summary-contact > span:first-child'),
      phone: x('.person-summary-contact > span:nth-child(2)'),
      age: x('.person-summary-contact > span:nth-child(3)'),
      absence: x('.person-summary-absence-slot'),
      completion: x('.person-summary-completion-slot'),
    }
  })))
  expect(positions[1]).toEqual(positions[0])
  expect(positions[2]).toEqual(positions[0])

  await page.setViewportSize({ width: 390, height: 844 })
  for (const row of rows) {
    const box = await row.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x + box!.width).toBeLessThanOrEqual(390)
    await expect(row.locator('.person-summary-absence-slot')).toHaveCount(1)
    await expect(row.locator('.person-summary-completion-slot')).toHaveCount(1)
  }
})

test('owner uploads a player photo from profile actions in the local demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()
  const profileDialog = page.getByRole('dialog', { name: 'Claudia Pérez' })
  await profileDialog.getByRole('button', { name: 'Acciones de Claudia Pérez' }).click()
  await profileDialog.getByRole('button', { name: 'Cambiar foto' }).click()

  const photoDialog = page.getByRole('dialog', { name: 'Foto de Claudia Pérez' })
  await expect(photoDialog.getByRole('button', { name: 'Guardar foto' })).toBeDisabled()
  await photoDialog.getByRole('button', { name: 'Ajustar foto actual' }).click()
  await expect(photoDialog.getByLabel('Mover fotografía para encuadrarla')).toBeVisible()
  await photoDialog.getByLabel('Seleccionar fotografía').setInputFiles({
    name: 'claudia.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=', 'base64'),
  })
  await expect(photoDialog.getByLabel('Mover fotografía para encuadrarla')).toBeVisible()
  await expect(photoDialog.getByLabel('Zoom de la fotografía')).toBeEnabled()
  await expect(photoDialog.getByRole('button', { name: 'Guardar foto' })).toBeEnabled()
  await photoDialog.getByRole('button', { name: 'Guardar foto' }).click()
  await expect(photoDialog).toHaveCount(0)
  await expect(page.getByText('Foto de Claudia Pérez actualizada en la demo.')).toBeVisible()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()
  await expect(page.getByRole('dialog', { name: 'Claudia Pérez' }).getByAltText('Fotografía de Claudia Pérez')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
})

test('owner can readjust a stored photo without selecting a file again', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()
  const profile = page.getByRole('dialog', { name: 'Claudia Pérez' })
  await profile.getByRole('button', { name: 'Acciones de Claudia Pérez' }).click()
  await profile.getByRole('button', { name: 'Cambiar foto' }).click()
  const photo = page.getByRole('dialog', { name: 'Foto de Claudia Pérez' })
  await photo.getByRole('button', { name: 'Ajustar foto actual' }).click()
  const zoom = photo.getByLabel('Zoom de la fotografía')
  await expect(zoom).toBeEnabled()
  await zoom.focus()
  await zoom.press('ArrowRight')
  await photo.getByRole('button', { name: 'Guardar foto' }).click()
  await expect(photo).toHaveCount(0)
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()
  await expect(page.getByRole('dialog', { name: 'Claudia Pérez' }).getByAltText('Fotografía de Claudia Pérez')).toHaveAttribute('src', /^data:image\/jpeg;base64,/)
})

test('owner can move and zoom a portrait before saving it', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver datos de Claudia Pérez' }).click()
  const profile = page.getByRole('dialog', { name: 'Claudia Pérez' })
  await profile.getByRole('button', { name: 'Acciones de Claudia Pérez' }).click()
  await profile.getByRole('button', { name: 'Cambiar foto' }).click()
  const photo = page.getByRole('dialog', { name: 'Foto de Claudia Pérez' })
  const portrait = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 400
    canvas.height = 800
    const context = canvas.getContext('2d')!
    context.fillStyle = '#f7f3ef'
    context.fillRect(0, 0, 400, 800)
    context.fillStyle = '#185d4f'
    context.fillRect(80, 80, 240, 240)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await photo.getByLabel('Seleccionar fotografía').setInputFiles({ name: 'retrato.png', mimeType: 'image/png', buffer: Buffer.from(portrait, 'base64') })
  const zoom = photo.getByLabel('Zoom de la fotografía')
  await expect(zoom).toHaveValue('1.5')
  const stage = photo.getByLabel('Mover fotografía para encuadrarla')
  const image = stage.getByAltText('Vista previa del encuadre')
  const before = await image.getAttribute('style')
  const box = await stage.boundingBox()
  if (!box) throw new Error('No se ha podido medir el encuadre.')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 35)
  await page.mouse.up()
  await expect(image).not.toHaveAttribute('style', before ?? '')
  await zoom.focus()
  await zoom.press('ArrowRight')
  await expect(zoom).toHaveValue('1.55')
  await photo.getByRole('button', { name: 'Guardar foto' }).click()
  await expect(photo).toHaveCount(0)
})

test('owner uploads photos for coach, Dirección and owner in the local demo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()

  for (const [group, name] of [['Entrenadores', 'Andrea López'], ['Dirección', 'Carlos Dirección'], ['Owners', 'Lucía Martín']]) {
    const section = page.locator('.team-member-group').filter({ has: page.locator('summary', { hasText: group }) })
    await section.locator('summary').click()
    await section.getByRole('button', { name: `Ver datos de ${name}` }).click()
    const profile = page.getByRole('dialog', { name })
    await profile.getByRole('button', { name: `Acciones de ${name}` }).click()
    await profile.getByRole('button', { name: 'Cambiar foto' }).click()
    const photo = page.getByRole('dialog', { name: `Foto de ${name}` })
    await photo.getByLabel('Seleccionar fotografía').setInputFiles({
      name: 'perfil.png', mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=', 'base64'),
    })
    await photo.getByRole('button', { name: 'Guardar foto' }).click()
    await expect(photo).toHaveCount(0)
    await section.getByRole('button', { name: `Ver datos de ${name}` }).click()
    await expect(page.getByRole('dialog', { name }).getByAltText(`Fotografía de ${name}`)).toBeVisible()
    await page.getByRole('dialog', { name }).getByRole('button', { name: `Acciones de ${name}` }).click()
    await page.getByRole('dialog', { name }).getByRole('button', { name: 'Cerrar' }).click()
  }
})

test('the player sees the photo uploaded by the owner in profile data', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Ajustes' }).click()
  await page.getByRole('menuitem', { name: 'Equipo' }).click()
  await page.getByText('Jugadoras activas', { exact: true }).click()
  await page.getByRole('button', { name: 'Ver datos de Marta Sánchez' }).click()
  const profile = page.getByRole('dialog', { name: 'Marta Sánchez' })
  await profile.getByRole('button', { name: 'Acciones de Marta Sánchez' }).click()
  await profile.getByRole('button', { name: 'Cambiar foto' }).click()
  const photo = page.getByRole('dialog', { name: 'Foto de Marta Sánchez' })
  await photo.getByLabel('Seleccionar fotografía').setInputFiles({
    name: 'marta.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/RZkAAAAASUVORK5CYII=', 'base64'),
  })
  await photo.getByRole('button', { name: 'Guardar foto' }).click()
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Editar mis datos' }).click()
  const ownProfile = page.getByRole('dialog', { name: 'Datos de perfil' })
  await expect(ownProfile.getByAltText('Fotografía de Marta Sánchez')).toBeVisible()
  await expect(ownProfile.getByLabel('Seleccionar fotografía')).toHaveCount(0)
})

test('desktop training editor scrolls only its form and keeps the session summary fixed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Entrenamientos' }).click()
  await page.getByRole('button', { name: /Editar entrenamiento/ }).first().click()

  const heading = page.locator('.training-editor-heading')
  const editorScroll = page.locator('.training-editor-scroll')
  const editorActions = page.locator('.training-editor-actions')
  const initialHeadingTop = (await heading.boundingBox())?.y
  await expect(editorActions).toHaveCSS('position', 'static')
  expect(await editorActions.evaluate((element) => element.closest('.training-editor-scroll') !== null)).toBe(true)
  await editorScroll.hover()
  await page.mouse.wheel(0, 900)

  await expect.poll(async () => editorScroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  expect(await page.locator('.content').evaluate((element) => element.scrollTop)).toBe(0)
  expect((await heading.boundingBox())?.y).toBe(initialHeadingTop)
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientHeight))

  await editorScroll.evaluate((element) => { element.scrollTop = element.scrollHeight })
  const scrollBox = await editorScroll.boundingBox()
  const actionsBox = await editorActions.boundingBox()
  expect((actionsBox?.y ?? 0) + (actionsBox?.height ?? 0)).toBeLessThanOrEqual((scrollBox?.y ?? 0) + (scrollBox?.height ?? 0))
})

test('desktop calendar presents daily groups in the agreed order', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendar = page.getByRole('region', { name: 'Calendario de planificación' })
  await calendar.getByRole('button', { name: /^8 de septiembre:/ }).click()

  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo aviso' }).click()
  const announcementDialog = page.getByRole('dialog', { name: 'Crear aviso' })
  await announcementDialog.getByLabel('Título').fill('Aviso para validar el orden diario')
  await announcementDialog.getByLabel('Descripción').fill('Contenido de prueba para la agenda del día.')
  await announcementDialog.getByRole('button', { name: 'Crear aviso' }).click()

  await page.getByRole('button', { name: 'Añadir' }).click()
  await page.getByRole('menuitem', { name: 'Nuevo partido' }).click()
  const matchDialog = page.getByRole('dialog', { name: 'Nuevo partido' })
  await matchDialog.getByLabel('Rival', { exact: true }).fill('Rival de prueba E2E')
  await matchDialog.getByRole('button', { name: 'Guardar partido' }).click()

  const headings = await page.locator('.selected-planning-week .task-week-heading h2').allTextContents()
  expect(headings.slice(0, 5)).toEqual(['Avisos', 'Resultados de encuestas', 'Entrenamientos', 'Partidos', '7 sept – 13 sept 2026'])
})

test('player opens survey results from calendar and remains there after closing', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T12:00:00+02:00') })
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()
  const calendar = page.getByRole('region', { name: 'Calendario de planificación' })
  await calendar.getByRole('button', { name: /^8 de septiembre:/ }).click()

  await page.getByRole('button', { name: /Disponibilidad para concentración/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Disponibilidad para concentración' })
  await expect(dialog).toContainText('17 de 18 jugadoras')
  await dialog.getByRole('button', { name: 'Cerrar resultados' }).click()

  await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Disponibilidad para concentración' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Encuestas', exact: true })).toHaveCount(0)
})

test('player can update an active survey from its calendar card', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Ver como').selectOption('player')
  await page.getByRole('button', { name: 'Calendario' }).click()

  await page.getByRole('button', { name: 'Modificar respuesta' }).click()
  const dialog = page.getByRole('dialog', { name: 'Disponibilidad para dos convocatorias' })
  await expect(dialog.getByRole('button', { name: 'Guardar cambios' })).toBeVisible()
  await expect(dialog.getByLabel('Disponible seguro').first()).toBeChecked()
  await expect(dialog.getByRole('button', { name: 'Responder más tarde y cerrar encuesta' })).toHaveClass(/primary-button/)
  await expect(dialog.getByRole('button', { name: 'Cerrar encuesta', exact: true })).toHaveCount(0)
})

test('desktop survey filtering returns to aggregate results after clearing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Gestión' }).click()
  await page.getByRole('menuitem', { name: 'Encuestas' }).click()
  await page.getByRole('button', { name: /Valoración del inicio de temporada/ }).click()

  const dialog = page.getByRole('dialog', { name: /Valoración del inicio de temporada/ })
  await dialog.getByPlaceholder('Buscar jugadora de la temporada…').fill('Lucía Moreno')
  await expect(dialog).toContainText('no ha respondido a la encuesta')
  await expect(dialog.getByRole('button', { name: 'Guardar PDF' })).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Quitar filtro de jugadora' }).click()
  await expect(dialog).toContainText('14 de 18 jugadoras')
  await expect(dialog.getByRole('button', { name: 'Guardar PDF' })).toBeVisible()
})

test('desktop role navigation respects owner, coach, management and player access', async ({ page }) => {
  await page.goto('/')
  const sidebar = page.locator('.sidebar')
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toBeVisible()

  await page.getByLabel('Ver como').selectOption('coach')
  await expect(sidebar.getByRole('button', { name: 'Gestión' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toHaveCount(0)

  await page.getByLabel('Ver como').selectOption('viewer')
  await expect(sidebar.getByRole('button', { name: 'Resumen' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Calendario' })).toHaveCount(0)

  await page.getByLabel('Ver como').selectOption('player')
  await expect(sidebar.getByRole('button', { name: 'Calendario' })).toBeVisible()
  await expect(sidebar.getByRole('button', { name: 'Gestión' })).toHaveCount(0)
  await expect(sidebar.getByRole('button', { name: 'Ajustes' })).toHaveCount(0)
})
