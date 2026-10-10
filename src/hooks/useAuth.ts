import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { errorText } from '../lib/errors'
import { supabase } from '../lib/supabase'
import { clearProfilePhotoCache, setProfilePhotoCacheUser } from '../services/profilePhotoService'

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
        if (data.session) setProfilePhotoCacheUser(data.session.user.id)
        else void clearProfilePhotoCache()
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
          if (nextSession) setProfilePhotoCacheUser(nextSession.user.id)
          else void clearProfilePhotoCache()
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
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      if (error) setErrorMessage(error.message)
    } catch (error) {
      setErrorMessage(errorText(error))
    }
  }

  async function signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) setErrorMessage(error.message)
    } catch (error) {
      setErrorMessage(errorText(error))
    }
  }

  return { session, loading, errorMessage, signInWithGoogle, signOut }
}
