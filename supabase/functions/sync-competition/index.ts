/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  addMatchStatistics,
  discoverCalendarUrl,
  fixtureIdentity,
  inferSeason,
  parseFixtures,
  parseStandings,
} from './parser.ts'
import type { ParsedFixture, PlayerStatistic } from './parser.ts'

const DISCOVERY_URL = 'https://rugbyaragon.com/senior-femenino-xv/'
const MATCHREADY_ORIGIN = 'https://rugbyaragon.matchready.es'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  let admin: any
  let syncRunId: string | undefined
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authorization = request.headers.get('Authorization') ?? ''
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión no válida.' }, 401)
    const { data: profile } = await userClient.from('profiles').select('is_owner, is_approved, is_archived').eq('id', user.id).single()
    if (!profile?.is_owner || !profile.is_approved || profile.is_archived) {
      return json({ error: 'Solo el owner puede sincronizar la competición.' }, 403)
    }

    admin = createClient(supabaseUrl, serviceKey)
    const { data: syncRun, error: runError } = await admin
      .from('competition_sync_runs')
      .insert({ status: 'running' })
      .select('id')
      .single()
    if (runError) throw runError
    syncRunId = syncRun.id

    const discoveryHtml = await fetchText(DISCOVERY_URL)
    const calendarUrl = discoverCalendarUrl(discoveryHtml, DISCOVERY_URL)
    const calendarHtml = await fetchText(calendarUrl)
    const fixtures = parseFixtures(calendarHtml)
    const standings = parseStandings(calendarHtml)
    if (!fixtures.length) throw new Error('MatchReady no ha devuelto partidos reconocibles.')
    if (!standings.length) throw new Error('MatchReady no ha devuelto una clasificación reconocible.')
    const season = inferSeason(fixtures)
    const statistics = await parsePlayerStatistics(fixtures)
    const syncedAt = new Date().toISOString()

    const fixtureRows = fixtures.map((fixture) => ({
      id: `${season.id}:${fixture.sourceMatchId ?? fixtureIdentity(fixture)}`,
      competition_season_id: season.id,
      source_match_id: fixture.sourceMatchId,
      round: fixture.round,
      round_order: fixture.roundOrder,
      match_date: fixture.matchDate,
      kickoff_time: fixture.kickoffTime,
      home_team: fixture.homeTeam,
      away_team: fixture.awayTeam,
      home_score: fixture.homeScore,
      away_score: fixture.awayScore,
      status: fixture.status,
    }))
    const standingRows = standings.map((row) => ({ ...row, competition_season_id: season.id }))
    const statisticRows = statistics.map((row) => ({ ...row, competition_season_id: season.id }))
    const { error: snapshotError } = await admin.rpc('replace_competition_snapshot', {
      checked_season: {
        id: season.id,
        name: season.name,
        starts_on: season.startsOn,
        source_label: 'MatchReady · Federación Aragonesa de Rugby',
        source_url: calendarUrl,
        synced_at: syncedAt,
      },
      checked_fixtures: fixtureRows,
      checked_standings: standingRows,
      checked_player_stats: statisticRows,
    })
    if (snapshotError) throw snapshotError

    const { error: finishError } = await admin.from('competition_sync_runs').update({
      competition_season_id: season.id,
      status: 'succeeded',
      fixtures_count: fixtureRows.length,
      standings_count: standingRows.length,
      player_stats_count: statisticRows.length,
      finished_at: syncedAt,
    }).eq('id', syncRunId)
    if (finishError) throw finishError

    return json({
      season: season.name,
      fixtures: fixtureRows.length,
      standings: standingRows.length,
      playerStats: statisticRows.length,
      syncedAt,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo sincronizar MatchReady.'
    if (admin && syncRunId) {
      await admin.from('competition_sync_runs').update({
        status: 'failed', error_message: message, finished_at: new Date().toISOString(),
      }).eq('id', syncRunId)
    }
    return json({ error: message }, 500)
  }
})

async function parsePlayerStatistics(fixtures: ParsedFixture[]) {
  const completed = fixtures.filter((fixture) => fixture.sourceMatchId)
  const aggregate = new Map<string, PlayerStatistic>()
  for (let index = 0; index < completed.length; index += 4) {
    const batch = completed.slice(index, index + 4)
    await Promise.all(batch.map(async (fixture) => {
      const html = await fetchText(`${MATCHREADY_ORIGIN}/es/public/competition/${fixture.sourceMatchId}/match_statistics/`)
      addMatchStatistics(html, fixture, aggregate)
    }))
  }
  return [...aggregate.values()]
}

async function fetchText(url: string) {
  const parsed = new URL(url)
  if (parsed.hostname !== 'rugbyaragon.com' && parsed.hostname !== 'rugbyaragon.matchready.es') {
    throw new Error('La fuente descubierta no pertenece a la Federación ni a MatchReady.')
  }
  const response = await fetch(url, { headers: { 'User-Agent': 'CDU-Rugby-Competition-Sync/1.0' } })
  if (!response.ok) throw new Error(`La fuente de competición ha respondido con ${response.status}.`)
  return response.text()
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
