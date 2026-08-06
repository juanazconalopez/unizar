import { useMemo } from 'react'

export function Avatar({ name }: { name: string }) {
  const initials = useMemo(
    () => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    [name],
  )

  return <span aria-hidden="true" className="avatar">{initials}</span>
}
