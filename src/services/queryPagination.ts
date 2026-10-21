type Page<T> = { data: T[] | null; error: unknown }

// Por debajo del máximo habitual de la API. Cada consulta debe ordenar por una
// clave única (o añadirla al final del orden) para no saltar filas entre páginas.
export const QUERY_PAGE_SIZE = 500

export async function fetchAllPages<T>(loadPage: (from: number, to: number) => PromiseLike<Page<T>>): Promise<Page<T>> {
  const rows: T[] = []
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await loadPage(from, from + QUERY_PAGE_SIZE - 1)
    // Nunca presentar un informe parcial como si la carga hubiese terminado.
    if (error) return { data: null, error }
    rows.push(...(data ?? []))
    if (!data || data.length < QUERY_PAGE_SIZE) return { data: rows, error: null }
  }
}
