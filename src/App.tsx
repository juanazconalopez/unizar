import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'

type Profile = {
  display_name: string
  is_approved: boolean
  is_active: boolean
  is_collaborator: boolean
  is_owner: boolean
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    async function loadProfile() {
      if (!session?.user) {
        setProfile(null)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(
          'display_name, is_approved, is_active, is_collaborator, is_owner',
        )
        .eq('id', session.user.id)
        .single()

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setProfile(data)
    }

    loadProfile()
  }, [session])

  async function signInWithGoogle() {
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      setErrorMessage(error.message)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <p>Comprobando sesión...</p>
  }

  if (!session) {
    return (
      <main>
        <h1>Entrenamientos</h1>

        <button onClick={signInWithGoogle}>
          Continuar con Google
        </button>

        {errorMessage && <p>{errorMessage}</p>}
      </main>
    )
  }

  return (
    <main>
      <h1>Entrenamientos</h1>

      <p>Sesión iniciada como {session.user.email}</p>

      {profile ? (
        <>
          <p>Nombre: {profile.display_name}</p>
          <p>Aprobado: {profile.is_approved ? 'Sí' : 'No'}</p>
          <p>Jugador activo: {profile.is_active ? 'Sí' : 'No'}</p>
          <p>Owner: {profile.is_owner ? 'Sí' : 'No'}</p>
        </>
      ) : (
        <p>Cargando perfil...</p>
      )}

      {errorMessage && <p>{errorMessage}</p>}

      <button onClick={signOut}>Cerrar sesión</button>
    </main>
  )
}

export default App