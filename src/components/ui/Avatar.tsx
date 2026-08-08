import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import './Avatar.css'

const alignmentStyles: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 0,
  lineHeight: 1,
  textAlign: 'center',
}

export function Avatar({ name }: { name: string }) {
  const initials = useMemo(
    () => name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase(),
    [name],
  )

  return <span aria-hidden="true" className="avatar" style={alignmentStyles}>{initials}</span>
}
