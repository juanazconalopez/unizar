import { useEffect, useState } from 'react'
import type { CrossTeamCallupReference } from '../lib/crossTeamCallups'
import { errorText } from '../lib/errors'
import { fetchCrossTeamCallupReference } from '../services/crossTeamCallupsService'

export function useCrossTeamCallupReference(matchId: string, enabled: boolean, demo: boolean, demoReference?: CrossTeamCallupReference) {
  const [loaded, setLoaded] = useState<{ matchId: string; reference?: CrossTeamCallupReference; error?: string } | null>(null)
  useEffect(() => {
    if (!enabled || demo) return
    let active = true
    void fetchCrossTeamCallupReference(matchId).then((reference) => {
      if (active) setLoaded({ matchId, reference })
    }).catch((error) => {
      if (active) setLoaded({ matchId, error: errorText(error) })
    })
    return () => { active = false }
  }, [demo, enabled, matchId])
  if (!enabled) return { reference: undefined, loading: false, error: undefined }
  if (demo) return { reference: demoReference, loading: false, error: undefined }
  const result = loaded?.matchId === matchId ? loaded : null
  return { reference: result?.reference, loading: !result, error: result?.error }
}
