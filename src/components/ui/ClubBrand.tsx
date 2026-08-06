import clubLogo from '../../assets/BFCZgzPP.png'

export function ClubBrand({ compact = false, onClick }: { compact?: boolean; onClick?: () => void }) {
  const content = (
    <>
      <span className="club-logo-wrap"><img alt="" className="club-logo" src={clubLogo} /></span>
      <span className="brand-copy"><strong>CDU Rugby</strong><small>Senior femenino</small></span>
    </>
  )

  const className = `brand${compact ? ' compact-brand' : ''}`
  if (onClick) return <button className={className} onClick={onClick} type="button">{content}</button>
  return <div className={className}>{content}</div>
}
