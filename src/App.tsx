import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

function App() {
  const [estado, setEstado] = useState('Comprobando conexión...')

  useEffect(() => {
    async function comprobarConexion() {
      try {
        const { error } = await supabase
          .from('tabla_prueba_conexion')
          .select('*')
          .limit(1)

        if (!error) {
          setEstado('✅ Conexión correcta con Supabase')
          return
        }

        if (error.code === 'PGRST205' || error.code === '42P01') {
          setEstado(
            '✅ Supabase responde correctamente. La tabla de prueba no existe, como esperábamos.',
          )
          return
        }

        setEstado(`⚠️ Supabase responde, pero devuelve: ${error.message}`)
      } catch (error) {
        const mensaje =
          error instanceof Error ? error.message : 'Error desconocido'

        setEstado(`❌ No se pudo conectar: ${mensaje}`)
      }
    }

    comprobarConexion()
  }, [])

  return (
    <main style={{ padding: '40px', fontFamily: 'sans-serif' }}>
      <h1>Aplicación de entrenamientos</h1>
      <p>{estado}</p>
    </main>
  )
}

export default App