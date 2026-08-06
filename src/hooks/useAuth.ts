import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setErrorMessage(error.message)
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => setSession(nextSession),
    )

    return () => subscription.unsubscribe()
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
