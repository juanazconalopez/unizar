import type { IconName } from '../../components/Icon'
import type { CSSProperties } from 'react'
import type { VideoPoolKey, WorkGroupKey } from './types'

export const WORK_GROUPS: { key: WorkGroupKey; name: string; color: string; soft: string; icon: IconName }[] = [
  { key: 'botiquin', name: 'Botiquín', color: '#a92e6c', soft: '#fce7f2', icon: 'medicalCross' },
  { key: 'equipaciones', name: 'Equipaciones', color: '#285ab0', soft: '#e8f0ff', icon: 'users' },
  { key: 'terceros', name: '3º tiempos', color: '#8a6300', soft: '#fff4c4', icon: 'spark' },
  { key: 'eventos', name: 'Eventos', color: '#7250a4', soft: '#eee7fa', icon: 'calendar' },
  { key: 'material', name: 'Material', color: '#a95400', soft: '#ffedd5', icon: 'strategy' },
  { key: 'merchan', name: 'Merchan', color: '#3f7429', soft: '#e8f2df', icon: 'trophy' },
  { key: 'camara', name: 'Cámara', color: '#b23928', soft: '#ffe8e1', icon: 'video' },
  { key: 'fichas', name: 'Fichas', color: '#56606c', soft: '#eceef1', icon: 'tasks' },
  { key: 'entrenadores', name: 'Entrenadores', color: '#39483f', soft: '#f4f6f4', icon: 'users' },
]
export const VIDEO_POOLS: { key: VideoPoolKey; name: string; groups: WorkGroupKey[] }[] = [
  { key: 'merchan', name: 'Merchan', groups: ['merchan'] },
  { key: 'staff', name: 'Cámara / Fichas / Entrenadores', groups: ['camara', 'fichas', 'entrenadores'] },
  { key: 'material', name: 'Material', groups: ['material'] },
  { key: 'terceros', name: '3º tiempos', groups: ['terceros'] },
  { key: 'eventos', name: 'Eventos', groups: ['eventos'] },
  { key: 'equipaciones', name: 'Equipaciones', groups: ['equipaciones'] },
  { key: 'botiquin', name: 'Botiquín', groups: ['botiquin'] },
]

export function groupStyle(key: WorkGroupKey): CSSProperties {
  const group = WORK_GROUPS.find((item) => item.key === key)!
  return { '--group-color': group.color, '--group-soft': group.soft } as CSSProperties
}

// Transcripción de la distribución facilitada. No se deducen cuentas por similitud.
export const INITIAL_WORK_MEMBERS: Record<WorkGroupKey, string[]> = {
  botiquin: ['Noella Esques', 'Sofía Pascual', 'Inés Serrano', 'Nagore Astorga', 'Beatriz Pacha', 'María Rodrigo', 'Ángela Rodríguez'],
  equipaciones: ['Alex Espinosa', 'Izarbe Rodríguez', 'María De Benito', 'Inés Santolaria', 'Jimena Corellano', 'Pilar Usón', 'Gabriela Pérez'],
  terceros: ['Lucía Orcos', 'Ainara Mur', 'Ainhoa Allue', 'Elena Pérez', 'Nuria Cabello', 'Lorena Lopez'],
  eventos: ['Inés Federío', 'Ana Lázaro', 'Paula Ceña', 'Bea Pejenaute'],
  material: ['Claudia Calvo', 'Patricia Martínez', 'Inés Jarauta', 'Inés Acero', 'Marta Briñas', 'Ana Noguero Sanz', 'Inés Pace', 'Jara Murguía Alonso'],
  merchan: ['Sofía Serrano', 'Laura Miramón', 'Leyre Lázaro', 'Nastia Moreno', 'Elena Valero'],
  camara: ['Matilde Gurrea', 'Nerea Andres', 'Zaira Díaz'],
  fichas: ['Inés Moreno Arjol', 'Ysa Sanz'],
  entrenadores: ['Isabel Salinas'],
}
