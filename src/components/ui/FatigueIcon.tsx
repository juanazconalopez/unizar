export function FatigueIcon({ level, size = 24 }: { level: number; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={`fatigue-icon level-${level}`}
      height={size}
      viewBox="0 0 32 32"
      width={size}
    >
      <circle cx="16" cy="16" fill="#ffd45a" r="13" stroke="#c69624" strokeWidth="1.5" />
      {level <= 2 ? (
        <>
          <path d="M9.5 13c1.2-1.4 2.5-1.4 3.7 0" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M18.8 13c1.2-1.4 2.5-1.4 3.7 0" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.6" />
        </>
      ) : (
        <>
          <circle cx="11.3" cy="12.7" fill="#5b4a1d" r="1.3" />
          <circle cx="20.7" cy="12.7" fill="#5b4a1d" r="1.3" />
        </>
      )}
      {level === 1 && <path d="M10 18c1.5 3.1 3.5 4.4 6 4.4s4.5-1.3 6-4.4" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.8" />}
      {level === 2 && <path d="M11 18.5c1.4 1.9 3 2.7 5 2.7s3.6-.8 5-2.7" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.8" />}
      {level === 3 && <path d="M11.5 20h9" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.8" />}
      {level === 4 && (
        <>
          <path d="M11 21c1.4-1.9 3-2.7 5-2.7s3.6.8 5 2.7" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.8" />
          <path d="M24.5 8.5c0 0-2.6 3.1-2.6 4.8a2.6 2.6 0 0 0 5.2 0c0-1.7-2.6-4.8-2.6-4.8Z" fill="#69b9dc" stroke="#3789ad" strokeWidth="1" />
        </>
      )}
      {level >= 5 && (
        <>
          <path d="M10.5 21.5c1.5-2.4 3.3-3.3 5.5-3.3s4 .9 5.5 3.3" fill="none" stroke="#5b4a1d" strokeLinecap="round" strokeWidth="1.8" />
          <circle cx="8.5" cy="17" fill="#ef8068" opacity=".85" r="2" />
          <circle cx="23.5" cy="17" fill="#ef8068" opacity=".85" r="2" />
        </>
      )}
    </svg>
  )
}
