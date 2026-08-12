export type ParsedFixture = {
  sourceMatchId: string | null
  round: string
  roundOrder: number
  matchDate: string
  kickoffTime: string | null
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: 'scheduled' | 'final' | 'postponed'
}

export type PlayerStatistic = {
  player: string
  team: string
  points: number
  tries: number
  conversions: number
  penalties: number
  drops: number
  yellow_cards: number
  red_cards: number
}

export function discoverCalendarUrl(html: string, discoveryUrl: string) {
  const source = html.match(/<iframe[^>]+src=["']([^"']*matchready[^"']*\/public\/calendar\/[^"']*\/combined\/?)['"]/i)?.[1]
  if (!source) throw new Error('La Federación no publica ahora mismo un calendario MatchReady reconocible.')
  return new URL(decodeHtml(source), discoveryUrl).toString()
}

export function parseFixtures(html: string): ParsedFixture[] {
  const roundMarkers = parseRoundMarkers(html)

  return [...html.matchAll(/<tr class="eventRow[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1])
    if (cells.length < 6) return []
    const dateTime = cleanText(cells[0]).match(/(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}:\d{2}))?/)
    const homeTeam = fontText(cells[1])
    const awayTeam = fontText(cells[5])
    if (!dateTime || !homeTeam || !awayTeam) return []
    // MatchReady represents bye slots as artificial matches (usually
    // "Descanso" against "Descanso"). They are not fixtures and must not
    // affect the calendar, round counts or statistics.
    if (isByeTeam(homeTeam) || isByeTeam(awayTeam)) return []
    const score = fontText(cells[3]).match(/(\d+)\s*-\s*(\d+)/)
    const sourceMatchId = cells[3].match(/\/competition\/(\d+)\/match_statistics/i)?.[1] ?? null
    const marker = roundMarkers.filter((item) => item.index < match.index).at(-1)
    const round = marker?.label ?? 'Jornada'
    const postponed = /aplazad|suspendid/i.test(cleanText(match[1]))
    return [{
      sourceMatchId,
      round,
      roundOrder: marker?.order ?? 0,
      matchDate: spanishDate(dateTime[1]),
      kickoffTime: dateTime[2] ?? null,
      homeTeam,
      awayTeam,
      homeScore: score ? Number(score[1]) : null,
      awayScore: score ? Number(score[2]) : null,
      status: postponed ? 'postponed' as const : score ? 'final' as const : 'scheduled' as const,
    }]
  })
}

function parseRoundMarkers(html: string) {
  // Limit headings to MatchReady working-day portlets. Other <h4> elements
  // belong to classification/statistics sections and are not competition rounds.
  const markers = [...html.matchAll(/<div\s+class=["'][^"']*\bworkingDayRow\b[^"']*["'][^>]*>[\s\S]*?<div\s+class=["'][^"']*\bportlet-title\b[^"']*["'][^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/gi)]
  let lastOrder = 0
  return markers.map((match) => {
    const label = cleanText(match[1])
    const numberedRound = Number(label.match(/\d+/)?.[0] ?? 0)
    lastOrder = numberedRound || lastOrder + 1
    return { index: match.index, label, order: lastOrder }
  })
}

export function parseStandings(html: string) {
  const section = html.match(/id="classificationTab"([\s\S]*?)id="squareCompetitionTab"/i)?.[1] ?? ''
  return [...section.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap((match) => {
    const cells = [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanText(cell[1]))
    if (cells.length < 14 || !/^\d+$/.test(cells[0])) return []
    return [{
      position: numeric(cells[0]), team: cells[1], played: numeric(cells[2]), won: numeric(cells[3]),
      drawn: numeric(cells[4]), lost: numeric(cells[5]), points_for: numeric(cells[6]),
      points_against: numeric(cells[7]), difference: numeric(cells[8]), offensive_bonus: numeric(cells[11]),
      defensive_bonus: numeric(cells[12]), points: numeric(cells[13]),
    }]
  })
}

export function addMatchStatistics(
  html: string,
  fixture: ParsedFixture,
  aggregate: Map<string, PlayerStatistic>,
) {
  const teams = [fixture.homeTeam, fixture.awayTeam]
  const scorerTables = [...html.matchAll(/<h4>\s*Anotadores\s*<\/h4>[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/gi)]
  scorerTables.slice(0, 2).forEach((table, teamIndex) => {
    for (const row of tableRows(table[1])) {
      if (row.length < 3 || !row[2]) continue
      const stat = playerStat(aggregate, teams[teamIndex], row[2])
      const type = row[1].toUpperCase()
      if (type === 'E') { stat.tries += 1; stat.points += 5 }
      else if (type === 'T') { stat.conversions += 1; stat.points += 2 }
      else if (type === 'CG' || type === 'CP' || type === 'P') { stat.penalties += 1; stat.points += 3 }
      else if (type === 'D') { stat.drops += 1; stat.points += 3 }
    }
  })
  addCards(html, 'Expulsiones temporales equipo local', teams[0], 'yellow_cards', aggregate)
  addCards(html, 'Expulsiones temporales equipo visitante', teams[1], 'yellow_cards', aggregate)
  addCards(html, 'Expulsiones definitivas equipo local', teams[0], 'red_cards', aggregate)
  addCards(html, 'Expulsiones definitivas equipo visitante', teams[1], 'red_cards', aggregate)
}

export function inferSeason(fixtures: ParsedFixture[]) {
  const earliest = fixtures.map((fixture) => fixture.matchDate).sort()[0]
  const [year, month] = earliest.split('-').map(Number)
  const startYear = month >= 7 ? year : year - 1
  const suffix = String(startYear + 1).slice(-2)
  return {
    id: `matchready-aragon-senior-f-xv-${startYear}-${suffix}`,
    name: `${startYear}–${suffix}`,
    startsOn: `${startYear}-07-01`,
  }
}

export function fixtureIdentity(fixture: ParsedFixture) {
  return slug(`${fixture.matchDate}-${fixture.homeTeam}-${fixture.awayTeam}`)
}

function addCards(html: string, heading: string, team: string, field: 'yellow_cards' | 'red_cards', aggregate: Map<string, PlayerStatistic>) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const body = html.match(new RegExp(`<h4>\\s*${escaped}\\s*<\\/h4>[\\s\\S]*?<tbody>([\\s\\S]*?)<\\/tbody>`, 'i'))?.[1]
  if (!body) return
  for (const row of tableRows(body)) {
    if (row[0]) playerStat(aggregate, team, row[0])[field] += 1
  }
}

function playerStat(aggregate: Map<string, PlayerStatistic>, team: string, player: string) {
  const key = `${team}:${player}`
  if (!aggregate.has(key)) aggregate.set(key, {
    player, team, points: 0, tries: 0, conversions: 0, penalties: 0,
    drops: 0, yellow_cards: 0, red_cards: 0,
  })
  return aggregate.get(key)!
}

function tableRows(html: string) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => (
    [...match[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cleanText(cell[1]))
  ))
}

function slug(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

function numeric(value: string) { return Number(value.replace(/[^\d-]/g, '')) || 0 }
function isByeTeam(value: string) {
  return /^(descanso|descansa|libre|bye)$/i.test(value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim())
}
function spanishDate(value: string) { const [day, month, year] = value.split('/'); return `${year}-${month}-${day}` }
function fontText(html: string) { return cleanText(html.match(/<font[^>]*>([\s\S]*?)<\/font>/i)?.[1] ?? '') }
function cleanText(html: string) { return decodeHtml(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() }

function decodeHtml(value: string) {
  const named: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Ntilde: 'Ñ', ntilde: 'ñ', uuml: 'ü' }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === '#') return String.fromCodePoint(Number.parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10))
    return named[entity] ?? `&${entity};`
  })
}
