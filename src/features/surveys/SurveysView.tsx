import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { todayIso } from '../../lib/dates'
import { errorText } from '../../lib/errors'
import type { Season } from '../../types'
import { fetchManageSurveys, fetchSurveyDraft, fetchSurveyResults, publishSurvey, saveSurveyDraft } from '../../services/surveysService'
import type { ManagedSurvey, SurveyDraftQuestion, SurveyResults, SurveyVisibility } from '../../services/surveysService'
import { participationPercentage } from './surveySelectors'

type SurveyStatus = 'Activa' | 'Cerrada' | 'Borrador' | 'Cancelada'
type SurveyVisibilityLabel = 'Compartida con el equipo' | 'Gestión' | 'Privada'
type DisplaySurvey = {
  id: string
  number: number
  title: string
  description: string | null
  seasonId: string
  visibility: SurveyVisibilityLabel
  startsOn: string
  endsOn: string
  responses: number
  recipients: number
  status: SurveyStatus
}
type DraftQuestion = { id: string | number; type: 'long' | 'single' | 'multiple'; text: string; options: string[] }

const demoSurveys: DisplaySurvey[] = [
  { id: 'wellbeing', number: 1, title: 'Valoración del inicio de temporada', description: 'Queremos ajustar las próximas semanas de entrenamiento a cómo os estáis sintiendo en este comienzo.', seasonId: 'demo-season', visibility: 'Compartida con el equipo', startsOn: '2026-09-08', endsOn: '2026-09-14', responses: 14, recipients: 18, status: 'Activa' },
  { id: 'schedule', number: 2, title: 'Disponibilidad para concentración', description: 'Necesitamos conocer vuestra disponibilidad para cerrar el viaje y la convocatoria.', seasonId: 'demo-season', visibility: 'Gestión', startsOn: '2026-09-01', endsOn: '2026-09-07', responses: 17, recipients: 18, status: 'Cerrada' },
  { id: 'medical', number: 3, title: 'Seguimiento preventivo', description: 'Esta encuesta sirve para preparar el seguimiento individual de prevención.', seasonId: 'demo-season', visibility: 'Privada', startsOn: '2026-09-15', endsOn: '2026-09-21', responses: 0, recipients: 18, status: 'Borrador' },
]
const demoPlayers = [{ name: 'Laura Martín', responded: true }, { name: 'Lucía Moreno', responded: false }, { name: 'Marta Pérez', responded: true }]
const initialQuestions: DraftQuestion[] = [{ id: 1, type: 'single', text: '', options: ['', ''] }]

export function SurveysView({ demo = false, initialSurveyId, isOwner, seasons = [] }: { demo?: boolean; initialSurveyId?: string; isOwner: boolean; seasons?: Season[] }) {
  const initialSurveys = demo ? demoSurveys.filter((survey) => isOwner || survey.visibility !== 'Privada') : []
  const [surveys, setSurveys] = useState<DisplaySurvey[]>(initialSurveys)
  const [selected, setSelected] = useState<DisplaySurvey | null>(() => initialSurveys.find((survey) => survey.id === initialSurveyId) ?? null)
  const [editor, setEditor] = useState<'create' | 'edit' | null>(null)
  const [editingSurvey, setEditingSurvey] = useState<DisplaySurvey | null>(null)
  const [questions, setQuestions] = useState<DraftQuestion[]>(initialQuestions)
  const [playerQuery, setPlayerQuery] = useState('')
  const [loading, setLoading] = useState(!demo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<SurveyResults | null>(null)
  const activeSeason = seasons.find((season) => season.start_date <= todayIso() && season.end_date >= todayIso()) ?? seasons[0]
  const defaultSurveyDate = activeSeason
    ? todayIso() < activeSeason.start_date ? activeSeason.start_date : todayIso() > activeSeason.end_date ? activeSeason.end_date : todayIso()
    : todayIso()
  const [draftSeasonId, setDraftSeasonId] = useState(activeSeason?.id ?? '')
  const player = selected?.visibility === 'Compartida con el equipo' && playerQuery.trim()
    ? demoPlayers.find((candidate) => candidate.name.toLocaleLowerCase().includes(playerQuery.trim().toLocaleLowerCase()))
    : undefined
  const selectedResults = results?.survey.id === selected?.id ? results : null

  async function loadSurveys() {
    if (demo) return
    setLoading(true)
    try {
      const loaded = await fetchManageSurveys()
      const visible = loaded.map((survey, index) => toDisplaySurvey(survey, index + 1))
      setSurveys(visible)
      setSelected(visible.find((survey) => survey.id === initialSurveyId) ?? null)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    if (demo) return () => { active = false }
    void fetchManageSurveys().then((loaded) => {
      if (!active) return
      const visible = loaded.map((survey, index) => toDisplaySurvey(survey, index + 1))
      setSurveys(visible)
      setSelected(visible.find((survey) => survey.id === initialSurveyId) ?? null)
    }).catch((cause) => { if (active) setError(errorText(cause)) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [demo, initialSurveyId])

  useEffect(() => {
    let active = true
    if (demo || !selected || selected.status === 'Borrador') return () => { active = false }
    void fetchSurveyResults(selected.id).then((value) => { if (active) setResults(value) }).catch((cause) => { if (active) setError(errorText(cause)) })
    return () => { active = false }
  }, [demo, selected])

  function openEditor(mode: 'create' | 'edit', survey: DisplaySurvey | null = null) {
    setError('')
    setEditingSurvey(survey)
    setDraftSeasonId(survey?.seasonId ?? activeSeason?.id ?? '')
    setQuestions(initialQuestions)
    if (mode === 'edit' && survey && !demo) {
      setSaving(true)
      void fetchSurveyDraft(survey.id).then((draft) => {
        setDraftSeasonId(draft.seasonId)
        setQuestions(draft.questions.map(toDraftQuestion))
      }).catch((cause) => setError(errorText(cause))).finally(() => setSaving(false))
    }
    if (mode === 'edit') setSelected(null)
    setEditor(mode)
  }

  function closeEditor() { if (!saving) { setEditor(null); setEditingSurvey(null); setError('') } }

  async function saveSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    const description = String(form.get('description')).trim()
    const startsOn = String(form.get('startsOn'))
    const endsOn = String(form.get('endsOn'))
    const visibility = String(form.get('visibility')) as SurveyVisibilityLabel
    const publishNow = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish'
    if (!title) return
    setSaving(true); setError('')
    try {
      if (demo) {
        if (editor === 'edit' && editingSurvey) {
          setSurveys((current) => current.map((survey) => survey.id === editingSurvey.id ? { ...survey, title, description: description || null, startsOn, endsOn, visibility, status: publishNow ? 'Activa' : survey.status } : survey))
          setSelected(null)
        } else {
          setSurveys((current) => [{ id: `demo-survey-${Date.now()}`, number: Math.max(0, ...current.map((survey) => survey.number)) + 1, title, description: description || null, seasonId: 'demo-season', visibility, startsOn, endsOn, responses: 0, recipients: 18, status: publishNow ? 'Activa' : 'Borrador' }, ...current])
        }
      } else {
        if (!draftSeasonId) throw new Error('Selecciona una temporada activa antes de crear la encuesta.')
        const surveyId = await saveSurveyDraft({
          id: editingSurvey?.id, seasonId: draftSeasonId, title, description: description || null, startsOn, endsOn,
          visibility: visibilityToDatabase(visibility), questions: questions.map((question) => ({ prompt: question.text, type: question.type, required: true, options: question.options.map((label) => ({ label })) })),
        })
        if (publishNow) await publishSurvey(surveyId)
        await loadSurveys()
      }
      setEditor(null); setEditingSurvey(null)
    } catch (cause) {
      setError(errorText(cause))
    } finally {
      setSaving(false)
    }
  }

  return <section className="page surveys-page">
    <PageHeader eyebrow="GESTIÓN" title="Encuestas" subtitle="Crea, publica y consulta encuestas de la temporada activa." action={<button className="primary-button" disabled={saving} onClick={() => openEditor('create')} type="button">Crear encuesta</button>} />
    {error && !editor && <p className="form-error">{error}</p>}
    {loading && <p className="page-loading">Cargando encuestas…</p>}
    {!loading && !surveys.length && <div className="empty-state"><h2>Aún no hay encuestas</h2><p>Crea un borrador para preparar la primera consulta del equipo.</p></div>}
    {!!surveys.length && <div className="survey-list">{surveys.map((survey) => <button className="survey-card" key={survey.id} onClick={() => { setPlayerQuery(''); setSelected(survey) }} type="button"><span className="survey-number">{survey.number}</span><span className="survey-card-copy"><span className="task-meta"><span>{survey.visibility}</span><span>·</span><span>{survey.status}</span></span><strong>{survey.title}</strong>{survey.description && <small className="survey-card-description">{survey.description}</small>}<small>{periodLabel(survey)} · {survey.responses}/{survey.recipients} respuestas ({participationPercentage(survey.responses, survey.recipients)}%)</small></span></button>)}</div>}

    {editor && <Modal className="survey-editor-dialog" disabled={saving} labelledBy="survey-editor-title" onClose={closeEditor} onSubmit={saveSurvey}>
      <div className="panel-form-heading"><div><span className="eyebrow">{editor === 'edit' ? 'BORRADOR' : 'NUEVA ENCUESTA'}</span><h2 id="survey-editor-title">{editor === 'edit' ? 'Editar encuesta' : 'Crear encuesta'}</h2></div><button aria-label="Cerrar editor" className="icon-button" onClick={closeEditor} type="button">×</button></div>
      <div className="form-grid"><label className="full-field">Título<input autoFocus defaultValue={editingSurvey?.title ?? ''} name="title" placeholder="Ej. Valoración del viaje" required /></label><label className="full-field">Descripción / finalidad<textarea defaultValue={editingSurvey?.description ?? ''} maxLength={600} name="description" placeholder="Explica para qué se recogen las respuestas y cómo debe responder el equipo." rows={3} /></label><label>Inicio<input defaultValue={editingSurvey?.startsOn ?? defaultSurveyDate} name="startsOn" required type="date" /></label><label>Fin<input defaultValue={editingSurvey?.endsOn ?? defaultSurveyDate} name="endsOn" required type="date" /></label><label className="full-field">Visibilidad<select defaultValue={editingSurvey?.visibility ?? (isOwner ? 'Privada' : 'Gestión')} name="visibility"><option>Compartida con el equipo</option><option>Gestión</option>{isOwner && <option>Privada</option>}</select></label></div>
      <p className="form-hint">Opcional · máximo 600 caracteres. Las jugadoras la leerán antes de responder.</p>
      <QuestionEditor questions={questions} setQuestions={setQuestions} />
      {error && <p className="form-error">{error}</p>}
      <button className="secondary-button compact" disabled={saving} onClick={() => setQuestions((current) => [...current, { id: `new-${current.length + 1}`, type: 'single', text: '', options: ['', ''] }])} type="button">+ Añadir pregunta</button><div className="form-actions"><button className="secondary-button" disabled={saving} onClick={closeEditor} type="button">Cancelar</button><button className="secondary-button" disabled={saving} name="action" type="submit" value="draft">Guardar borrador</button><button className="primary-button" disabled={saving} name="action" type="submit" value="publish">{saving ? 'Guardando…' : 'Publicar encuesta'}</button></div>
    </Modal>}

    {selected && <Modal className="survey-results-dialog" labelledBy="survey-results-title" onClose={() => setSelected(null)}>
      <div className="panel-form-heading"><div><span className="eyebrow">RESULTADOS {selected.status === 'Activa' ? 'PROVISIONALES' : ''}</span><h2 id="survey-results-title">Encuesta {selected.number} · {selected.title}</h2></div><button aria-label="Cerrar resultados" className="icon-button" onClick={() => setSelected(null)} type="button">×</button></div>
      {selected.description && <p className="survey-description">{selected.description}</p>}
      {selected.status === 'Borrador' ? <div className="survey-draft-summary"><p>Este borrador todavía no tiene respuestas. Puedes revisarlo antes de publicarlo.</p><button className="primary-button" onClick={() => openEditor('edit', selected)} type="button">Editar encuesta</button></div> : <>
        {demo && selected.visibility === 'Compartida con el equipo' && <label className="survey-player-filter">Ver respuestas de una jugadora<span className="survey-filter-input"><input onChange={(event) => setPlayerQuery(event.target.value)} placeholder="Buscar jugadora de la temporada…" value={playerQuery} />{playerQuery && <button aria-label="Quitar filtro de jugadora" onClick={() => setPlayerQuery('')} type="button">×</button>}</span></label>}
        {demo ? (playerQuery && selected.visibility === 'Compartida con el equipo' ? <PlayerAnswers player={player} query={playerQuery} /> : <AggregatedResults survey={selected} />) : selectedResults ? <ManagedAggregatedResults results={selectedResults} /> : <p className="page-loading">Cargando resultados…</p>}
        {((demo && selected.responses > 0 && (!playerQuery || Boolean(player?.responded))) || (!demo && (selectedResults?.participation.responses ?? 0) > 0)) && <div className="form-actions"><button className="secondary-button" onClick={() => window.print()} type="button">Guardar PDF</button></div>}
      </>}
    </Modal>}
  </section>
}

function toDisplaySurvey(survey: ManagedSurvey, number: number): DisplaySurvey {
  return { ...survey, number, visibility: visibilityFromDatabase(survey.visibility), status: statusFromDatabase(survey.status) }
}

function toDraftQuestion(question: SurveyDraftQuestion): DraftQuestion {
  return { id: question.id ?? `question-${question.prompt}`, text: question.prompt, type: question.type, options: question.options.map((option) => option.label) }
}

function periodLabel(survey: DisplaySurvey) { return `${survey.startsOn} – ${survey.endsOn}` }
function visibilityFromDatabase(visibility: SurveyVisibility): SurveyVisibilityLabel { return visibility === 'team' ? 'Compartida con el equipo' : visibility === 'management' ? 'Gestión' : 'Privada' }
function visibilityToDatabase(visibility: SurveyVisibilityLabel): SurveyVisibility { return visibility === 'Compartida con el equipo' ? 'team' : visibility === 'Gestión' ? 'management' : 'private' }
function statusFromDatabase(status: ManagedSurvey['status']): SurveyStatus { return status === 'published' ? 'Activa' : status === 'draft' ? 'Borrador' : 'Cancelada' }

function QuestionEditor({ questions, setQuestions }: { questions: DraftQuestion[]; setQuestions: React.Dispatch<React.SetStateAction<DraftQuestion[]>> }) {
  return <div className="survey-questions-editor"><span className="eyebrow">PREGUNTAS</span>{questions.map((question, index) => <article key={question.id}><b>{index + 1}</b><div><label>Tipo<select value={question.type} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, type: event.target.value as DraftQuestion['type'] } : item))}><option value="long">Respuesta larga</option><option value="single">Una opción</option><option value="multiple">Varias opciones</option></select></label><label>Pregunta<input aria-label={`Pregunta ${index + 1}`} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} placeholder="Escribe la pregunta…" required value={question.text} /></label>{question.type !== 'long' && <div className="survey-option-list">{question.options.map((option, optionIndex) => <div className="survey-option-editor" key={optionIndex}><input aria-label={`Opción ${optionIndex + 1} de pregunta ${index + 1}`} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item))} placeholder={`Opción ${optionIndex + 1}`} value={option} /><button aria-label={`Quitar opción ${optionIndex + 1} de pregunta ${index + 1}`} className="survey-remove-option" onClick={() => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: item.options.filter((_, valueIndex) => valueIndex !== optionIndex) } : item))} type="button">−</button></div>)}<button className="text-button" onClick={() => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: [...item.options, ''] } : item))} type="button">+ Añadir opción</button></div>}</div></article>)}</div>
}

function AggregatedResults({ survey }: { survey: DisplaySurvey }) {
  return <section className="survey-results"><header><p>{survey.responses} de {survey.recipients} jugadoras · {participationPercentage(survey.responses, survey.recipients)}% participación</p></header><article className="survey-result"><b>1</b><div><h3>¿Cómo valoras la semana?</h3>{[['Muy positiva', 9], ['Positiva', 4], ['Mejorable', 1]].map(([label, count]) => <div className="survey-bar" key={label as string}><span>{label as string}<small>{count as number} · {participationPercentage(count as number, survey.responses)}%</small></span><i><em style={{ width: `${participationPercentage(count as number, survey.responses)}%` }} /></i></div>)}</div></article><article className="survey-result"><b>2</b><div><h3>¿Qué mejorarías para la próxima semana?</h3><p>“El grupo ha trabajado con mucha energía.”</p><p>“Me gustaría dedicar más tiempo a la recuperación.”</p></div></article></section>
}

function ManagedAggregatedResults({ results }: { results: SurveyResults }) {
  return <section className="survey-results"><header><p>{results.participation.responses} de {results.participation.recipients} jugadoras · {participationPercentage(results.participation.responses, results.participation.recipients)}% participación</p></header>{results.questions.map((question, index) => <article className="survey-result" key={question.id}><b>{index + 1}</b><div><h3>{question.prompt}</h3>{question.options.map((option) => <div className="survey-bar" key={option.id}><span>{option.label}<small>{option.count} · {participationPercentage(option.count, results.participation.responses)}%</small></span><i><em style={{ width: `${participationPercentage(option.count, results.participation.responses)}%` }} /></i></div>)}{question.longAnswers.map((answer, answerIndex) => <p key={answerIndex}>“{answer.text}”</p>)}</div></article>)}</section>
}

function PlayerAnswers({ player, query }: { player: typeof demoPlayers[number] | undefined; query: string }) {
  if (!player) return <p className="survey-filter-message">No se ha encontrado ninguna jugadora activa llamada “{query}”.</p>
  if (!player.responded) return <p className="survey-filter-message"><strong>{player.name}</strong> no ha respondido a la encuesta.</p>
  return <section className="survey-results"><header><p>Respuestas de <strong>{player.name}</strong></p></header><article className="survey-result"><b>1</b><div><h3>¿Cómo valoras la semana?</h3><p>Muy positiva</p></div></article><article className="survey-result"><b>2</b><div><h3>¿Qué mejorarías para la próxima semana?</h3><p>“Me gustaría dedicar más tiempo a la recuperación.”</p></div></article></section>
}
