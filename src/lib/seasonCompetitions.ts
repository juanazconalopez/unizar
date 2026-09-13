import type { CSSProperties } from 'react'
import type { Match, SeasonCompetition, SeasonCompetitionColor } from '../types'

export type CompetitionPaletteEntry = {
  key: SeasonCompetitionColor
  label: string
  solid: string
  soft: string
  border: string
  text: string
}

export const COMPETITION_PALETTE: CompetitionPaletteEntry[] = [
  { key: 'purple', label: 'Morado', solid: '#7459ae', soft: '#f5f1ff', border: '#9a87cf', text: '#5e4697' },
  { key: 'blue', label: 'Azul', solid: '#397b9f', soft: '#edf6fb', border: '#83b6d0', text: '#286580' },
  { key: 'orange', label: 'Naranja', solid: '#bf6b22', soft: '#fff4e8', border: '#e1a46f', text: '#975116' },
  { key: 'red', label: 'Rojo', solid: '#b5544c', soft: '#fff0ed', border: '#d99a94', text: '#914039' },
  { key: 'teal', label: 'Turquesa', solid: '#2b7f83', soft: '#eaf7f7', border: '#79b8bb', text: '#21676a' },
  { key: 'pink', label: 'Rosa', solid: '#a94f7a', soft: '#fceef5', border: '#d291b0', text: '#893b61' },
  { key: 'slate', label: 'Pizarra', solid: '#596b7a', soft: '#f0f3f5', border: '#9dabb5', text: '#465864' },
  { key: 'gold', label: 'Dorado', solid: '#96711b', soft: '#fff8df', border: '#d1b75f', text: '#755710' },
]

export const DEFAULT_MATCH_COLOR = {
  solid: '#2d7653', soft: '#e4f2e8', border: '#82b59d', text: '#205d43',
}

export function isSeasonCompetitionColor(value: string): value is SeasonCompetitionColor {
  return COMPETITION_PALETTE.some((entry) => entry.key === value)
}

export function paletteEntry(color: SeasonCompetitionColor | string | null | undefined) {
  return COMPETITION_PALETTE.find((entry) => entry.key === color) ?? COMPETITION_PALETTE[0]
}

export function matchColor(match: Match) {
  if (match.status === 'draft' || match.match_kind === 'friendly') return DEFAULT_MATCH_COLOR
  return paletteEntry(match.season_competitions?.color)
}

export function matchColorStyle(match: Match): CSSProperties {
  const color = matchColor(match)
  return {
    '--match-color': color.solid,
    '--match-soft': color.soft,
    '--match-border': color.border,
    '--match-text': color.text,
  } as CSSProperties
}

export function compareMatches(first: Match, second: Match) {
  return first.match_date.localeCompare(second.match_date)
    || matchPriority(first) - matchPriority(second)
    || (first.kickoff_time ?? '').localeCompare(second.kickoff_time ?? '')
    || first.opponent.localeCompare(second.opponent, 'es')
}

export function competitionsForSeason(competitions: SeasonCompetition[], seasonId?: string) {
  return competitions
    .filter((competition) => competition.season_id === seasonId)
    .sort((first, second) => Number(second.is_default) - Number(first.is_default) || first.created_at.localeCompare(second.created_at))
}

export function matchLegendItems(matches: Match[]) {
  const items = new Map<string, { key: string; label: string; solid: string }>()
  for (const match of matches) {
    if (match.status === 'cancelled') continue
    if (match.status === 'draft' || match.match_kind === 'friendly') {
      items.set('default', { key: 'default', label: 'Amistosos y borradores', solid: DEFAULT_MATCH_COLOR.solid })
      continue
    }
    const competition = match.season_competitions
    const color = paletteEntry(competition?.color)
    items.set(competition?.id ?? 'competition', { key: competition?.id ?? 'competition', label: competition?.name ?? 'Competición', solid: color.solid })
  }
  return [...items.values()]
}

function matchPriority(match: Match) {
  if (match.match_kind === 'official' && match.season_competitions?.is_default) return 0
  if (match.match_kind === 'official') return 1
  return 2
}
