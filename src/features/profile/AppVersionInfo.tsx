import { useEffect, useState } from 'react'
import { APP_VERSION, getLatestAppVersion, isNewerAppVersion } from '../../lib/appVersion'
import { updateApp } from '../../lib/appRecovery'
import { errorText } from '../../lib/errors'

export function AppVersionInfo({ disabled = false, hasUnsavedChanges = false }: { disabled?: boolean; hasUnsavedChanges?: boolean }) {
  const [latestVersion, setLatestVersion] = useState<string | null>(null)
  const [checkError, setCheckError] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let controller: AbortController | undefined
    let timeout: number | undefined
    async function checkVersion() {
      controller?.abort()
      window.clearTimeout(timeout)
      const request = new AbortController()
      controller = request
      timeout = window.setTimeout(() => request.abort(), 10_000)
      try {
        if (!navigator.onLine) throw new Error('Sin conexión')
        const version = await getLatestAppVersion(request.signal)
        if (controller !== request) return
        setLatestVersion(version)
        setCheckError('')
      } catch {
        if (controller !== request) return
        setCheckError(navigator.onLine ? 'No se pudo comprobar si hay una versión nueva.' : 'Recupera la conexión para comprobar actualizaciones.')
      } finally {
        if (controller === request) window.clearTimeout(timeout)
      }
    }
    const check = () => { void checkVersion() }
    check()
    window.addEventListener('online', check)
    window.addEventListener('focus', check)
    return () => {
      window.removeEventListener('online', check)
      window.removeEventListener('focus', check)
      const pending = controller
      controller = undefined
      pending?.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  async function applyUpdate() {
    if (hasUnsavedChanges && !window.confirm('Hay datos de perfil sin guardar. ¿Quieres actualizar y descartar esos cambios?')) return
    setUpdateError('')
    setUpdating(true)
    try {
      await updateApp()
    } catch (error) {
      setUpdateError(errorText(error))
    } finally {
      setUpdating(false)
    }
  }

  const canUpdate = latestVersion !== null && isNewerAppVersion(latestVersion, APP_VERSION)
  return <div className="profile-app-version" aria-live="polite">
    <div className="profile-app-version-row">
      <span><strong>Versión {APP_VERSION}</strong><small>En este dispositivo</small></span>
      {canUpdate && <button className="secondary-button compact" disabled={disabled || updating} onClick={() => void applyUpdate()} type="button">
        {updating ? 'Actualizando…' : `Actualizar a ${latestVersion}`}
      </button>}
    </div>
    {checkError && <small role="status">{checkError}</small>}
    {updateError && <small className="form-error" role="alert">{updateError}</small>}
  </div>
}
