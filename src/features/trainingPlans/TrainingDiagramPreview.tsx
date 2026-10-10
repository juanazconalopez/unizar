import type { TacticsBoardData, TacticsElement } from '../../types'

// Compatibilidad de lectura con los esquemas guardados antes de retirar la pizarra.
export function TrainingDiagramPreview({ data, label }: { data: TacticsBoardData; label: string }) {
  return <div aria-label={label} className="tactics-preview" role="img">
    <svg aria-hidden="true" viewBox="0 0 900 520">
      <rect fill="#176b46" height="520" width="900" />
      <rect fill="#237b54" height="480" stroke="#f4f0d0" strokeWidth="3" width="860" x="20" y="20" />
      {[100, 450, 800].map((x) => <line key={x} stroke="#f4f0d0" strokeWidth="2" x1={x} x2={x} y1="20" y2="500" />)}
      {[220, 680].map((x) => <line key={x} stroke="#dce9d2" strokeDasharray="9 9" strokeWidth="2" x1={x} x2={x} y1="20" y2="500" />)}
      {[335, 565].map((x) => <line key={x} stroke="#dce9d2" strokeDasharray="5 11" x1={x} x2={x} y1="20" y2="500" />)}
      <text fill="rgba(255,255,255,.55)" fontFamily="Arial, sans-serif" fontSize="13" fontWeight="bold" x="35" y="47">
        {data.template === 'full' ? 'CAMPO COMPLETO' : data.template === 'half' ? 'MEDIO CAMPO' : 'ZONA DE 22'}
      </text>
      {data.elements.map((element) => <g key={element.id} transform={`translate(${element.x} ${element.y}) rotate(${element.rotation ?? 0}) scale(${element.scaleX ?? 1} ${element.scaleY ?? 1})`}>
        <DiagramElement element={element} />
      </g>)}
    </svg>
  </div>
}

function DiagramElement({ element }: { element: TacticsElement }) {
  if (element.type === 'player' || element.type === 'opponent') {
    const own = element.type === 'player'
    return <>
      <circle fill={own ? '#f1c84b' : '#7254a8'} r="15" stroke="white" strokeWidth="2" />
      <text dominantBaseline="central" fill={own ? '#173c2e' : 'white'} fontFamily="Arial, sans-serif" fontSize="11" fontWeight="bold" textAnchor="middle">{element.label ?? ''}</text>
    </>
  }
  if (element.type === 'cone') return <polygon fill="#ff8b32" points="-11,12 0,-13 11,12" stroke="white" strokeWidth="1.5" />
  if (element.type === 'ball') return <g transform="rotate(-22)">
    <ellipse fill="#f5e5c7" rx="14" ry="8" stroke="#683d28" strokeWidth="1.5" />
    <line stroke="#683d28" x1="-5" x2="5" y1="-2" y2="2" />
  </g>
  if (element.type === 'shield') return <rect fill="#286d91" height="32" rx="5" stroke="white" strokeWidth="2" width="22" x="-11" y="-16" />
  if (element.type === 'zone') return <rect fill="rgba(255,220,84,.28)" height="60" rx="7" stroke="#ffe36f" strokeWidth="2" width="120" />
  if (element.type === 'text') return <text fill="white" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" y="16">{element.label ?? 'Texto'}</text>
  const color = element.type === 'pass' ? '#8ed8ff' : element.type === 'defense' ? '#ff9f93' : '#ffe36f'
  return <>
    <line stroke={color} strokeDasharray={element.type === 'pass' ? '12 8' : element.type === 'defense' ? '4 6' : undefined} strokeWidth="4" x2="105" />
    <polygon fill={color} points="105,0 94,-5 94,5" />
  </>
}
