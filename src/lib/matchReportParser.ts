export type ReportTextItem = { page: number; x: number; y: number; text: string }
export type ReportEventDraft = { type: 'substitution' | 'yellow_card' | 'red_card'; minute: number; dorsal: number; replacementDorsal?: number }
export type ParsedMatchReport = { date: string | null; homeTeam: string | null; awayTeam: string | null; homeScore: number | null; awayScore: number | null; events: { home: ReportEventDraft[]; away: ReportEventDraft[] }; recognized: boolean }

type Row = { page: number; y: number; items: ReportTextItem[]; text: string }

function rowsOf(items: ReportTextItem[]): Row[] {
  const rows: Row[] = []
  for (const item of items.filter((value) => value.text.trim())) {
    let row = rows.find((value) => value.page === item.page && Math.abs(value.y - item.y) < 2)
    if (!row) { row = { page: item.page, y: item.y, items: [], text: '' }; rows.push(row) }
    row.items.push(item)
  }
  for (const row of rows) {
    row.items.sort((a, b) => a.x - b.x)
    row.text = row.items.map((item) => item.text.trim()).filter(Boolean).join(' ')
  }
  return rows.sort((a, b) => a.page - b.page || b.y - a.y)
}

function cells(row: Row | undefined, minX: number, maxX = Infinity) {
  return (row?.items ?? []).filter((item) => item.x >= minX && item.x < maxX && /^\d{1,3}$/.test(item.text.trim())).map((item) => ({ x: item.x, number: Number(item.text.trim()) }))
}

function nearby(row: Row | undefined, x: number): number | undefined {
  return cells(row, 75).find((cell) => Math.abs(cell.x - x) < 9)?.number
}

function parseChanges(rows: Row[], side: 'home' | 'away'): ReportEventDraft[] {
  const changesIndex = rows.findIndex((row) => /Cambios/i.test(row.text))
  const cardsIndex = rows.findIndex((row) => /Expulsiones temporales/i.test(row.text))
  if (changesIndex < 0 || cardsIndex < 0) return []
  const enterRows = rows.slice(changesIndex, cardsIndex).filter((row) => /Dorsal entra/i.test(row.text))
  const enter = enterRows[side === 'home' ? 0 : 1]
  const leave = rows.find((row) => row.page === enter?.page && Math.abs(row.y - (enter?.y ?? 0) + 12) < 3 && /Dorsal sale/i.test(row.text))
  const minute = rows.find((row) => row.page === enter?.page && Math.abs(row.y - (enter?.y ?? 0) + 24) < 3 && /Minuto/i.test(row.text))
  return cells(enter, 75).flatMap((cell) => {
    const dorsal = nearby(leave, cell.x)
    const at = nearby(minute, cell.x)
    return dorsal && at !== undefined ? [{ type: 'substitution' as const, dorsal, replacementDorsal: cell.number, minute: at }] : []
  })
}

function parseCards(rows: Row[], side: 'home' | 'away', type: 'yellow_card' | 'red_card'): ReportEventDraft[] {
  const cardsIndex = rows.findIndex((row) => /Expulsiones temporales/i.test(row.text))
  if (cardsIndex < 0) return []
  const section = rows.slice(cardsIndex + 1)
  const teamIndex = section.findIndex((row) => (side === 'home' ? /Equipo local:/i : /Equipo visitante:/i).test(row.text))
  if (teamIndex < 0) return []
  const block = section.slice(teamIndex + 1, teamIndex + 5)
  const dorsal = block.find((row) => /^Dorsal/i.test(row.text) || row.text.includes('Dorsal'))
  const minute = block.find((row) => /Minuto/i.test(row.text))
  const minX = type === 'yellow_card' ? 65 : 420
  const maxX = type === 'yellow_card' ? 355 : Infinity
  return cells(dorsal, minX, maxX).flatMap((cell) => {
    const at = cells(minute, minX, maxX).find((item) => Math.abs(item.x - cell.x) < 9)?.number
    return at !== undefined ? [{ type, dorsal: cell.number, minute: at }] : []
  })
}

export function parseMatchReport(items: ReportTextItem[]): ParsedMatchReport {
  const rows = rowsOf(items)
  const dateMatch = rows.map((row) => row.text).join(' ').match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  const resultIndex = rows.findIndex((row) => /Resultado del partido/i.test(row.text))
  const resultSection = resultIndex < 0 ? [] : rows.slice(resultIndex + 1, resultIndex + 5)
  const score = resultSection.map((row) => row.text).join(' ').match(/\b(\d{1,3})\s*-\s*(\d{1,3})\b/)
  const teams = resultSection.find((row) => row.items.some((item) => item.x < 250 && /\p{L}/u.test(item.text)) && row.items.some((item) => item.x > 330 && /\p{L}/u.test(item.text)))
  const homeTeam = teams?.items.filter((item) => item.x < 250).map((item) => item.text.trim()).filter(Boolean).join(' ') ?? null
  const awayTeam = teams?.items.filter((item) => item.x > 330).map((item) => item.text.trim()).filter(Boolean).join(' ') ?? null
  return {
    date: dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : null,
    homeTeam, awayTeam,
    homeScore: score ? Number(score[1]) : null,
    awayScore: score ? Number(score[2]) : null,
    events: {
      home: [...parseChanges(rows, 'home'), ...parseCards(rows, 'home', 'yellow_card'), ...parseCards(rows, 'home', 'red_card')],
      away: [...parseChanges(rows, 'away'), ...parseCards(rows, 'away', 'yellow_card'), ...parseCards(rows, 'away', 'red_card')],
    },
    recognized: resultIndex >= 0 && !!score,
  }
}
