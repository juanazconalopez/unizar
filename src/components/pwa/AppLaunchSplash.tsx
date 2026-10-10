import { useEffect, useState } from 'react'
import clubLogo from '../../assets/BFCZgzPP.png'

const launchPhotos = Object.values(import.meta.glob('../../assets/finalLiga2026/*.webp', {
  eager: true,
  import: 'default',
})) as string[]

const launchPhoto = launchPhotos[Math.floor(Math.random() * launchPhotos.length)]

type LaunchStage = 'photo' | 'brand' | 'leaving' | 'hidden'

export function AppLaunchSplash() {
  const [stage, setStage] = useState<LaunchStage>('photo')
  useEffect(() => {
    // La fotografía es decorativa y no debe retrasar el acceso a la aplicación.
    const timers = [
      window.setTimeout(() => setStage('brand'), 1000),
      window.setTimeout(() => setStage('leaving'), 1750),
      window.setTimeout(() => setStage('hidden'), 2000),
    ]
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  if (stage === 'hidden') return null

  return (
    <div className={`launch-splash ${stage}`} role="status">
      {launchPhoto && (
        <img
          alt=""
          className="launch-splash-photo"
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
