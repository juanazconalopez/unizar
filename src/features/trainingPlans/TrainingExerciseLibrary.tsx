import { useMemo, useState } from 'react'
import { Icon } from '../../components/Icon'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHeader } from '../../components/ui/PageHeader'
import type { TrainingExercisePreset } from '../../types'
import { TacticsBoardPreview } from './TacticsBoard'

export function TrainingExerciseLibrary({ presets, loading, error, onBack, onCreate, onEdit, onReload }: {
  presets: TrainingExercisePreset[]; loading: boolean; error: string; onBack: () => void; onCreate: () => void
  onEdit: (preset: TrainingExercisePreset) => void; onReload: () => void
}) {
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('es')
    return term ? presets.filter((preset) => `${preset.title} ${preset.description ?? ''}`.toLocaleLowerCase('es').includes(term)) : presets
  }, [presets, search])

  return <div className="page training-library-page">
    <button className="text-button training-detail-back" onClick={onBack} type="button">← Volver a entrenamientos</button>
    <PageHeader action={<button className="primary-button" onClick={onCreate} type="button"><Icon name="plus" size={17} />Crear ejercicio</button>} eyebrow="RECURSOS DEL CUERPO TÉCNICO" subtitle="Crea, revisa y reutiliza ejercicios con sus pizarras tácticas." title="Biblioteca de ejercicios" />
    <div className="training-library-toolbar"><label><Icon name="search" size={17} /><input aria-label="Buscar ejercicio" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre o descripción…" type="search" value={search} /></label><span>{filtered.length} {filtered.length === 1 ? 'ejercicio' : 'ejercicios'}</span></div>
    {error ? <div className="training-load-error"><p>{error}</p><button className="secondary-button compact" onClick={onReload} type="button">Reintentar</button></div>
      : loading ? <div className="training-loading">Cargando biblioteca…</div>
        : filtered.length ? <div className="training-library-grid">{filtered.map((preset) => {
          const hasDiagram = preset.diagram_data.elements.length > 0
          return <article className="training-library-card" key={preset.id}>
            <button aria-label={`Editar ejercicio ${preset.title}`} className="training-library-card-open" onClick={() => onEdit(preset)} type="button" />
            <div className={hasDiagram ? 'training-library-card-preview populated' : 'training-library-card-preview'}>{hasDiagram ? <TacticsBoardPreview data={preset.diagram_data} label={`Esquema de ${preset.title}`} /> : <div><span>Sin pizarra táctica</span></div>}</div>
            <div className="training-library-card-content"><div className="training-library-card-meta"><span><Icon name="clock" size={14} />{preset.duration_minutes} min</span>{hasDiagram && <span className="has-diagram"><Icon name="strategy" size={14} />Con esquema</span>}</div><h2>{preset.title}</h2><p>{preset.description || 'Sin descripción.'}</p></div>
            <button className="secondary-button compact training-library-edit" onClick={() => onEdit(preset)} type="button">Editar</button>
          </article>
        })}</div>
          : <EmptyState title={search ? 'No hay coincidencias' : 'La biblioteca está vacía'} text={search ? 'Prueba con otro término de búsqueda.' : 'Crea el primer ejercicio predefinido con su descripción y pizarra.'} />}
  </div>
}
