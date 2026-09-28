import { useEffect, useId, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Modal } from '../../components/ui/Modal'
import { errorText } from '../../lib/errors'
import { formatDate } from '../../lib/dates'
import { matchTitle } from '../../lib/matchTitle'
import { fetchPublishedMatchCoachNames, fetchSeasonTeamCoaches } from '../../services/seasonTeamsService'
import { loadProfilePhotoDataUrl } from '../../services/profilePhotoService'
import type { Match, MatchLineup, Profile, SeasonTeamCoach } from '../../types'

type GraphicProps = {
  match: Match
  entries: MatchLineup[]
  profiles: Profile[]
  onClose: () => void
  demo?: boolean
  demoCoaches?: SeasonTeamCoach[]
  onLoadPhoto?: (path: string) => Promise<string>
  canLoadPhotos?: boolean
  embedded?: boolean
  onOpen?: () => void
}

type Point = { x: number; y: number }

const EMPTY_COACHES: SeasonTeamCoach[] = []

const XV_POSITIONS: Record<number, Point> = {
  1: { x: 190, y: 235 }, 2: { x: 540, y: 235 }, 3: { x: 890, y: 235 },
  4: { x: 355, y: 355 }, 5: { x: 725, y: 355 },
  6: { x: 190, y: 475 }, 8: { x: 540, y: 475 }, 7: { x: 890, y: 475 },
  9: { x: 350, y: 595 }, 10: { x: 730, y: 595 },
  12: { x: 355, y: 715 }, 13: { x: 725, y: 715 },
  11: { x: 130, y: 835 }, 14: { x: 950, y: 835 },
  15: { x: 540, y: 975 },
}
const SEVENS_POSITIONS: Record<number, Point> = {
  1: { x: 175, y: 235 }, 3: { x: 470, y: 235 },
  2: { x: 320, y: 355 },
  4: { x: 520, y: 490 }, 5: { x: 640, y: 625 },
  6: { x: 770, y: 760 }, 7: { x: 900, y: 895 },
}

export function LineupGraphicDialog(props: GraphicProps) {
  return <LineupGraphic {...props} />
}

export function LineupGraphic({ match, entries, profiles, onClose, onOpen, demo = false, demoCoaches = EMPTY_COACHES, onLoadPhoto, canLoadPhotos = true, embedded = false }: GraphicProps) {
  const titleId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null)
  const zoomRef = useRef(1)
  const [zoom, setZoom] = useState(1)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [coachNames, setCoachNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const starters = match.rugby_format === 'sevens' ? 7 : 15
  const positions = starters === 7 ? SEVENS_POSITIONS : XV_POSITIONS
  const bySlot = new Map(entries.map((entry) => [entry.slot_number, entry]))
  const byId = new Map(profiles.map((profile) => [profile.id, profile]))
  const substitutes = [...entries].filter((entry) => entry.slot_number > starters).sort((a, b) => a.slot_number - b.slot_number)
  const substituteRows = Math.ceil(substitutes.length / 2)
  const coachTop = 1235 + Math.max(1, substituteRows) * 43 + 38
  const graphicHeight = Math.max(1500, coachTop + 56 + Math.max(1, coachNames.length) * 38 + 35)
  const topTrim = 56
  const visibleHeight = graphicHeight - topTrim
  const orderedSlots = starters === 7 ? [1, 3, 2, 4, 5, 6, 7] : [1, 2, 3, 4, 5, 6, 8, 7, 9, 10, 12, 13, 11, 14, 15]

  useEffect(() => {
    let cancelled = false
    const photoLoader = onLoadPhoto ?? (demo ? undefined : loadProfilePhotoDataUrl)
    const selectedProfiles = (canLoadPhotos ? entries : []).filter((entry) => entry.slot_number <= starters)
      .map((entry) => profiles.find((profile) => profile.id === entry.player_id))
      .filter((profile): profile is Profile => Boolean(profile?.avatar_path))
    async function load() {
      setLoading(true)
      const [coachResult, photoResults] = await Promise.all([
        match.team_id
          ? (demo
              ? Promise.resolve(demoCoaches.filter((assignment) => assignment.season_team_id === match.team_id)
                  .map((assignment) => profiles.find((profile) => profile.id === assignment.coach_id)?.display_name)
                  .filter((name): name is string => Boolean(name)))
              : fetchPublishedMatchCoachNames(match.id).catch(async () => {
                  if (!canLoadPhotos || !match.team_id) return []
                  const assignments = await fetchSeasonTeamCoaches([match.team_id])
                  return assignments.map((assignment) => profiles.find((profile) => profile.id === assignment.coach_id)?.display_name)
                    .filter((name): name is string => Boolean(name))
                }))
              .catch(() => [] as string[])
          : Promise.resolve([] as string[]),
        Promise.all(selectedProfiles.map(async (profile) => {
          if (!profile.avatar_path || !photoLoader) return null
          try { return [profile.id, await photoLoader(profile.avatar_path)] as const } catch { return null }
        })),
      ])
      if (cancelled) return
      setCoachNames(coachResult.sort((a, b) => a.localeCompare(b, 'es')))
      setPhotos(Object.fromEntries(photoResults.filter((item): item is readonly [string, string] => item !== null)))
      setLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [canLoadPhotos, demo, demoCoaches, entries, match.id, match.team_id, onLoadPhoto, profiles, starters])

  useEffect(() => {
    if (embedded) return
    const preview = previewRef.current
    if (!preview) return
    function startPinch(event: TouchEvent) {
      if (event.touches.length !== 2) return
      event.preventDefault()
      pinchRef.current = { distance: touchDistance(event.touches), zoom: zoomRef.current }
    }
    function movePinch(event: TouchEvent) {
      if (event.touches.length !== 2 || !pinchRef.current) return
      event.preventDefault()
      const next = Math.min(4, Math.max(1, pinchRef.current.zoom * touchDistance(event.touches) / pinchRef.current.distance))
      zoomRef.current = next
      setZoom(next)
    }
    function endPinch(event: TouchEvent) {
      if (event.touches.length < 2) pinchRef.current = null
    }
    preview.addEventListener('touchstart', startPinch, { passive: false })
    preview.addEventListener('touchmove', movePinch, { passive: false })
    preview.addEventListener('touchend', endPinch)
    preview.addEventListener('touchcancel', endPinch)
    return () => {
      preview.removeEventListener('touchstart', startPinch)
      preview.removeEventListener('touchmove', movePinch)
      preview.removeEventListener('touchend', endPinch)
      preview.removeEventListener('touchcancel', endPinch)
    }
  }, [embedded])

  function changeZoom(next: number) {
    const bounded = Math.min(4, Math.max(1, next))
    zoomRef.current = bounded
    setZoom(bounded)
  }

  async function downloadPng() {
    const svg = svgRef.current
    if (!svg) return
    setExporting(true)
    setError('')
    try {
      const exportSvg = svg.cloneNode(true) as SVGSVGElement
      exportSvg.style.removeProperty('width')
      const serialized = new XMLSerializer().serializeToString(exportSvg)
      const svgUrl = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }))
      const picture = new Image()
      try {
        await new Promise<void>((resolve, reject) => {
          picture.onload = () => resolve()
          picture.onerror = () => reject(new Error('No se ha podido preparar la imagen.'))
          picture.src = svgUrl
        })
        const canvas = document.createElement('canvas')
        canvas.width = 1080
        canvas.height = visibleHeight
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Este navegador no puede crear la imagen.')
        context.drawImage(picture, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('No se ha podido guardar la imagen.')), 'image/png'))
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `convocatoria-${match.match_date}-${match.season_teams?.name ?? 'equipo'}.png`.replace(/[\\/:*?"<>|]+/g, '-')
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      } finally { URL.revokeObjectURL(svgUrl) }
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setExporting(false)
    }
  }

  const graphic = <>
    {!embedded && <><div className="task-detail-heading"><div><span className="eyebrow">CONVOCATORIA PUBLICADA</span><h2 id={titleId}>Vista gráfica</h2><p>{matchTitle(match)} · {formatDate(match.match_date, { day: 'numeric', month: 'long', year: 'numeric' })}</p></div><button aria-label="Cerrar vista gráfica" className="icon-button" onClick={onClose} type="button">×</button></div><p className="lineup-graphic-help">Pellizca con dos dedos o usa + y − para ampliar. Desliza la imagen para recorrerla. Las jugadoras sin fotografía se muestran con sus iniciales.</p></>}
    <GraphicPreview embedded={embedded} onOpen={onOpen} previewRef={previewRef}>
      <svg aria-label="Imagen de la convocatoria" height={visibleHeight} ref={svgRef} role="img" style={!embedded ? { width: `${zoom * 100}%` } : undefined} viewBox={`0 0 1080 ${visibleHeight}`} width="1080" xmlns="http://www.w3.org/2000/svg">
        <rect fill="#073f36" height={visibleHeight} width="1080" />
        <g transform={`translate(0 -${topTrim})`}>
        <RugbyPitchMarkings />
        <rect fill="#052f2a" height="168" width="1080" />
        <text fill="#fff" fontFamily="Arial, sans-serif" fontSize={titleSize(matchTitle(match))} fontWeight="800" textAnchor="middle" x="540" y="120">{matchTitle(match)}</text>
        {orderedSlots.map((slot) => {
          const point = positions[slot]
          const profile = byId.get(bySlot.get(slot)?.player_id ?? '')
          const lines = nameLines(profile?.display_name ?? 'Sin asignar')
          return <g key={slot}>
            <defs><clipPath id={`lineup-photo-${slot}`}><circle cx={point.x} cy={point.y} r="33" /></clipPath></defs>
            <circle cx={point.x} cy={point.y} fill="#fff" r="36" stroke="#c7efda" strokeWidth="3" />
            {profile && photos[profile.id] ? <image clipPath={`url(#lineup-photo-${slot})`} height="66" href={photos[profile.id]} preserveAspectRatio="xMidYMid slice" width="66" x={point.x - 33} y={point.y - 33} /> : <text dominantBaseline="middle" fill="#0a604d" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="800" textAnchor="middle" x={point.x} y={point.y}>{initials(profile?.display_name ?? '?')}</text>}
            <rect fill="#f9f7ef" height={lines.length === 2 ? 46 : 42} rx="7" width="246" x={point.x - 123} y={point.y + 38} />
            <rect fill="#b5ddc8" height={lines.length === 2 ? 46 : 42} rx="7" width="46" x={point.x - 123} y={point.y + 38} />
            <text fill="#083b31" fontFamily="Arial, sans-serif" fontSize="24" fontWeight="800" textAnchor="middle" x={point.x - 100} y={point.y + 66}>{slot}</text>
            <text fill="#092e29" fontFamily="Arial, sans-serif" fontSize={lines.length === 2 ? 16 : 19} fontWeight="700" textAnchor="middle" x={point.x + 22} y={point.y + (lines.length === 2 ? 55 : 65)}>{lines.map((line, index) => <tspan key={line} x={point.x + 22} dy={index ? 18 : 0}>{line}</tspan>)}</text>
          </g>
        })}
        <rect fill="#052f2a" height={graphicHeight - 1108} width="1080" y="1108" />
        <text fill="#b5e4ce" fontFamily="Arial, sans-serif" fontSize="23" fontWeight="800" letterSpacing="3" x="53" y="1170">SUPLENTES</text>
        {substitutes.length ? substitutes.map((entry, index) => {
          const profile = byId.get(entry.player_id)
          const x = index % 2 ? 548 : 53
          const y = 1235 + Math.floor(index / 2) * 43
          return <g key={entry.player_id}><text fill="#a4dfc3" fontFamily="Arial, sans-serif" fontSize="25" fontWeight="800" x={x} y={y}>{entry.slot_number}</text><text fill="#fff" fontFamily="Arial, sans-serif" fontSize={substituteSize(profile?.display_name ?? '')} x={x + 45} y={y}>{profile?.display_name ?? 'Jugadora'}</text></g>
        }) : <text fill="#fff" fontFamily="Arial, sans-serif" fontSize="22" x="53" y="1235">Sin suplentes asignadas</text>}
        <line opacity="0.35" stroke="#b5e4ce" strokeWidth="2" x1="53" x2="1027" y1={coachTop - 49} y2={coachTop - 49} />
        <text fill="#b5e4ce" fontFamily="Arial, sans-serif" fontSize="23" fontWeight="800" letterSpacing="3" x="53" y={coachTop}>ENTRENADORES</text>
        {(coachNames.length ? coachNames : ['Sin entrenadores asignados']).map((name, index) => <text fill="#fff" fontFamily="Arial, sans-serif" fontSize="23" key={`${name}-${index}`} x="53" y={coachTop + 43 + index * 38}>{name}</text>)}
        </g>
      </svg>
    </GraphicPreview>
    {!embedded && <div aria-label="Zoom de la imagen" className="lineup-graphic-zoom-controls" role="group"><button aria-label="Reducir zoom" className="secondary-button compact" disabled={zoom <= 1} onClick={() => changeZoom(zoomRef.current - .5)} type="button">−</button><button aria-label="Restablecer zoom" className="secondary-button compact" disabled={zoom === 1} onClick={() => changeZoom(1)} type="button">{Math.round(zoom * 100)} %</button><button aria-label="Aumentar zoom" className="secondary-button compact" disabled={zoom >= 4} onClick={() => changeZoom(zoomRef.current + .5)} type="button">+</button></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!embedded && <div className="form-actions"><button className="secondary-button" onClick={onClose} type="button">Cerrar</button><button className="primary-button" disabled={loading || exporting} onClick={() => void downloadPng()} type="button">{loading ? 'Preparando imagen…' : exporting ? 'Guardando…' : 'Descargar PNG'}</button></div>}
  </>
  return embedded ? <div className="lineup-graphic-embedded">{graphic}</div> : <Modal className="lineup-graphic-dialog" disabled={exporting} labelledBy={titleId} onClose={onClose}>{graphic}</Modal>
}

function RugbyPitchMarkings() {
  const left = 42
  const right = 1038
  const tryTop = 254
  const tryBottom = 1020
  return <g>
    <rect fill="#075f4e" height="940" width="1080" y="168" />
    {Array.from({ length: 7 }, (_, index) => <rect fill={index % 2 ? '#086452' : '#075c4c'} height="134" key={index} width="1080" y={168 + index * 134} />)}
    <rect fill="#074d42" height="72" opacity="0.55" width={right - left} x={left} y="182" />
    <rect fill="#074d42" height="72" opacity="0.55" width={right - left} x={left} y={tryBottom} />
    <g fill="none" stroke="#d5ebdf" strokeWidth="3">
      <rect height="910" opacity="0.56" width={right - left} x={left} y="182" />
      {[tryTop, 422, 637, 852, tryBottom].map((y) => <line key={y} opacity={y === 637 ? 0.64 : 0.5} x1={left} x2={right} y1={y} y2={y} />)}
      {[561, 713].map((y) => <line key={y} opacity="0.48" strokeDasharray="21 27" x1={left} x2={right} y1={y} y2={y} />)}
      {[92, 191, 889, 988].map((x) => <line key={x} opacity="0.32" strokeDasharray="15 34" x1={x} x2={x} y1={tryTop + 10} y2={tryBottom - 10} />)}
      <path d="M 480 254 v -62 M 600 254 v -62 M 480 210 h 120 M 480 1020 v 62 M 600 1020 v 62 M 480 1064 h 120" opacity="0.7" strokeWidth="4" />
      <line opacity="0.5" x1="540" x2="540" y1="620" y2="654" />
    </g>
  </g>
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('es') ?? '').join('') }
function titleSize(title: string) { return title.length > 45 ? 25 : title.length > 32 ? 31 : 40 }
function substituteSize(name: string) { return name.length > 28 ? 18 : name.length > 22 ? 21 : 24 }
function nameLines(name: string) {
  if (name.length <= 18) return [name]
  const words = name.split(' ')
  const split = Math.ceil(words.length / 2)
  if (words.length > 1) return [words.slice(0, split).join(' '), words.slice(split).join(' ')].map((line) => line.length > 21 ? `${line.slice(0, 20)}…` : line)
  return [name.slice(0, 18), name.slice(18, 36)]
}

function touchDistance(touches: TouchList) {
  const first = touches[0]
  const second = touches[1]
  return Math.max(1, Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY))
}

function GraphicPreview({ children, embedded, onOpen, previewRef }: { children: ReactNode; embedded: boolean; onOpen?: () => void; previewRef: RefObject<HTMLDivElement | null> }) {
  if (embedded && onOpen) return <button aria-label="Ampliar imagen de la convocatoria" className="lineup-graphic-preview lineup-graphic-open" onClick={onOpen} type="button">{children}</button>
  return <div className="lineup-graphic-preview" ref={previewRef}>{children}</div>
}
