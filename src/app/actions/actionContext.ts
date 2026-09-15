export type ActionContext = {
  userId?: string
  reloadData: () => Promise<void>
  invalidateMatchMonths: (...dates: string[]) => void
  notify: (message: string) => void
  reportError: (error: unknown) => string
  requireConnection: () => void
}
