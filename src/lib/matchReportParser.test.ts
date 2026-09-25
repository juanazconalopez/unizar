import { describe, expect, it } from 'vitest'
import { parseMatchReport, type ReportTextItem } from './matchReportParser'

function item(page: number, y: number, x: number, text: string): ReportTextItem { return { page, y, x, text } }

describe('parseMatchReport', () => {
  it('extracts score and each side events from the federation layout', () => {
    const parsed = parseMatchReport([
      item(1, 233, 10, 'Resultado del partido'), item(1, 218, 90, 'Unizar femenino'), item(1, 218, 420, 'Ingenieros de Soria'), item(1, 200, 280, '46 - 7'),
      item(2, 760, 10, '18/10/2025'), item(2, 584, 280, 'Cambios'),
      item(2, 548, 20, 'Dorsal entra'), item(2, 548, 100, '16'), item(2, 536, 20, 'Dorsal sale'), item(2, 536, 100, '1'), item(2, 524, 30, 'Minuto'), item(2, 524, 100, '40'),
      item(2, 464, 20, 'Dorsal entra'), item(2, 464, 100, '23'), item(2, 452, 20, 'Dorsal sale'), item(2, 452, 100, '3'), item(2, 440, 30, 'Minuto'), item(2, 440, 100, '25'),
      item(2, 404, 120, 'Expulsiones temporales'), item(2, 404, 420, 'Expulsiones definitivas'),
      item(2, 391, 14, 'Equipo local:'), item(2, 368, 31, 'Dorsal'), item(2, 356, 31, 'Minuto'),
      item(2, 317, 14, 'Equipo visitante:'), item(2, 293, 31, 'Dorsal'), item(2, 293, 80, '14'), item(2, 281, 31, 'Minuto'), item(2, 281, 80, '40'),
    ])
    expect(parsed).toMatchObject({ date: '2025-10-18', homeTeam: 'Unizar femenino', awayTeam: 'Ingenieros de Soria', homeScore: 46, awayScore: 7, recognized: true })
    expect(parsed.events.home).toEqual([{ type: 'substitution', dorsal: 1, replacementDorsal: 16, minute: 40 }])
    expect(parsed.events.away).toEqual([{ type: 'substitution', dorsal: 3, replacementDorsal: 23, minute: 25 }, { type: 'yellow_card', dorsal: 14, minute: 40 }])
  })
  it('leaves data for manual review if the layout is unknown', () => {
    expect(parseMatchReport([item(1, 100, 20, 'Escaneo sin texto del acta')])).toMatchObject({ recognized: false, homeScore: null, events: { home: [], away: [] } })
  })
})
