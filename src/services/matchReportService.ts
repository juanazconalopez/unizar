import { parseMatchReport, type ReportTextItem } from '../lib/matchReportParser'
import { supabase } from '../lib/supabase'
import type { Match } from '../types'
import type { MatchReportValues, SavedReportEvent } from '../lib/matchMinutes'

export type { MatchReportValues, SavedReportEvent } from '../lib/matchMinutes'

export async function readMatchReportPdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecciona un PDF.')
  if (file.size > 10 * 1024 * 1024) throw new Error('El PDF no puede superar 10 MB.')
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const items: ReportTextItem[] = []
  try {
    const document = await loadingTask.promise
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      for (const item of content.items) {
        if ('str' in item) items.push({ page: pageNumber, x: item.transform[4], y: item.transform[5], text: item.str })
      }
    }
  } finally { await loadingTask.destroy() }
  return parseMatchReport(items)
}

export async function loadMatchReportEvents(matchId: string): Promise<SavedReportEvent[]> {
  const { data, error } = await supabase.from('match_events')
    .select('event_type,event_minute,player_id,replacement_player_id,return_minute')
    .eq('match_id', matchId).order('event_minute').order('sort_order')
  if (error) throw error
  return data ?? []
}

export async function saveMatchReport(match: Match, values: MatchReportValues) {
  const { error } = await supabase.rpc('save_match_report', {
    checked_match_id: match.id, checked_team_score: values.scores.team,
    checked_opponent_score: values.scores.opponent, checked_duration: values.duration,
    checked_events: values.events,
  })
  if (error) throw error
}
