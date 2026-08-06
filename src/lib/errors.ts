export function errorText(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Ha ocurrido un error inesperado.'
}
