export function escapeXml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function downloadText(filename: string, content: string, mimeType: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }))
  const link = document.createElement('a')
  link.href = url
  link.download = safeFilename(filename)
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(content)
      return
    } catch {
      // Some browsers expose the API but deny it; use the selection fallback.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()
  const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
  textarea.remove()
  if (!copied) throw new Error('No se ha podido copiar. Selecciona el contenido manualmente.')
}

function safeFilename(filename: string) {
  return filename.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
}
