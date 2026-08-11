import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorText } from '../lib/errors'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setErrorMessage(error.message)
        setSession(data.session)
      })
      .catch((error: unknown) => {
        if (!cancelled) setErrorMessage(errorText(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!cancelled) {
          setSession(nextSession)
          setLoading(false)
        }
      },
    )

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  async function signInWithGoogle() {
    setErrorMessage('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setErrorMessage(error.message)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setErrorMessage(error.message)
  }

  return { session, loading, errorMessage, signInWithGoogle, signOut }
}
