import { useEffect, useRef, useState } from 'react'
import { loadContentImageBlob } from '../services/contentImagesService'

export function ContentImage({ id, compact = false, eager = false }: { id: string; compact?: boolean; eager?: boolean }) {
  const [url, setUrl] = useState('')
  const [failed, setFailed] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(() => eager || typeof IntersectionObserver === 'undefined')
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (shouldLoad || !hostRef.current) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setShouldLoad(true)
      observer.disconnect()
    }, { rootMargin: '240px' })
    observer.observe(hostRef.current)
    return () => observer.disconnect()
  }, [shouldLoad])

  useEffect(() => {
    if (!shouldLoad) return
    let active = true
    let objectUrl = ''
    void loadContentImageBlob(id).then((blob) => {
      if (!active) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    }).catch(() => { if (active) setFailed(true) })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, shouldLoad])

  return <span className={`content-image-host${compact ? ' compact' : ''}`} ref={hostRef}>
    {failed
      ? <span className="content-image-error">Imagen no disponible</span>
      : !url
        ? <span aria-label="Cargando imagen" className={`content-image-loading${compact ? ' compact' : ''}`} />
        : <a className={`content-image-link${compact ? ' compact' : ''}`} href={url} rel="noreferrer" target="_blank"><img alt="Imagen adjunta" loading="lazy" src={url} /></a>}
  </span>
}
