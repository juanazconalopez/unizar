import { parseMatchReport, type ReportTextItem } from '../lib/matchReportParser'
import { supabase } from '../lib/supabase'
import type { Match } from '../types'

export type SavedReportEvent = { event_type: 'substitution' | 'yellow_card' | 'red_card'; event_minute: number; player_id: string; replacement_player_id: string | null }

export async function readMatchReportPdf(file: File) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecciona un PDF.')
  if (file.size > 10 * 1024 * 1024) throw new Error('El PDF no puede superar 10 MB.')
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  const document = await loadingTask.promise
  const items: ReportTextItem[] = []
  try {
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

export async function matchReportUrl(path: string) {
  const { data, error } = await supabase.storage.from('match-reports').createSignedUrl(path, 60)
  if (error) throw error
  return data.signedUrl
}

export async function saveMatchReport(match: Match, file: File, scores: { team: number; opponent: number }, duration: number, events: SavedReportEvent[], reviewed: boolean) {
  const path = `${match.id}/${crypto.randomUUID()}.pdf`
  const { error: uploadError } = await supabase.storage.from('match-reports').upload(path, file, { contentType: 'application/pdf', upsert: false })
  if (uploadError) throw uploadError
  try {
    const { error } = await supabase.rpc('save_match_report', {
      checked_match_id: match.id, checked_path: path, checked_team_score: scores.team,
      checked_opponent_score: scores.opponent, checked_duration: duration,
      checked_events: events, checked_events_reviewed: reviewed,
    })
    if (error) throw error
  } catch (error) {
    await supabase.storage.from('match-reports').remove([path])
    throw error
  }
  if (match.match_report_path) await supabase.storage.from('match-reports').remove([match.match_report_path])
}
