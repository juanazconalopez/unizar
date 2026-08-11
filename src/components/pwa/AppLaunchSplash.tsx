import { useCallback, useEffect, useRef, useState } from 'react'
import clubLogo from '../../assets/BFCZgzPP.png'

const launchPhotos = Object.values(import.meta.glob('../../assets/finalLiga2026/*.webp', {
  eager: true,
  import: 'default',
})) as string[]

const launchPhoto = launchPhotos[Math.floor(Math.random() * launchPhotos.length)]

type LaunchStage = 'photo' | 'brand' | 'leaving' | 'hidden'

export function AppLaunchSplash() {
  const [stage, setStage] = useState<LaunchStage>('photo')
  const started = useRef(false)
  const timers = useRef<number[]>([])

  const startSequence = useCallback(() => {
    if (started.current) return
    started.current = true
    timers.current = [
      window.setTimeout(() => setStage('brand'), 1000),
      window.setTimeout(() => setStage('leaving'), 1750),
      window.setTimeout(() => setStage('hidden'), 2000),
    ]
  }, [])

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  if (stage === 'hidden') return null

  return (
    <div className={`launch-splash ${stage}`} role="status">
      {launchPhoto && (
        <img
          alt=""
          className="launch-splash-photo"
          onError={startSequence}
          onLoad={startSequence}
          src={launchPhoto}
        />
      )}
      <div className="launch-splash-overlay" />
      <div aria-live="polite" className="launch-splash-content">
        <span className="launch-splash-logo">
          <img alt="CDU Rugby Zaragoza" src={clubLogo} />
        </span>
        <div aria-hidden="true" className="loader" />
        <p>Preparando tu espacio…</p>
      </div>
    </div>
  )
}
