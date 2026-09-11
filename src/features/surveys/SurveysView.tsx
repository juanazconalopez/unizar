import { useState } from 'react'
import type { FormEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { PageHeader } from '../../components/ui/PageHeader'
import { participationPercentage } from './surveySelectors'

type SurveyStatus = 'Activa' | 'Cerrada' | 'Borrador'
type DemoSurvey = { id: string; number: number; title: string; visibility: 'Compartida con el equipo' | 'Gestión' | 'Privada'; period: string; responses: number; recipients: number; status: SurveyStatus }
type DraftQuestion = { id: number; type: 'long' | 'single' | 'multiple'; text: string; options: string[] }

const demoSurveys: DemoSurvey[] = [
  { id: 'wellbeing', number: 1, title: 'Valoración del inicio de temporada', visibility: 'Compartida con el equipo', period: '8–14 sept. 2026', responses: 14, recipients: 18, status: 'Activa' },
  { id: 'schedule', number: 2, title: 'Disponibilidad para concentración', visibility: 'Gestión', period: '1–7 sept. 2026', responses: 17, recipients: 18, status: 'Cerrada' },
  { id: 'medical', number: 3, title: 'Seguimiento preventivo', visibility: 'Privada', period: '15–21 sept. 2026', responses: 0, recipients: 18, status: 'Borrador' },
]
const demoPlayers = [{ name: 'Laura Martín', responded: true }, { name: 'Lucía Moreno', responded: false }, { name: 'Marta Pérez', responded: true }]
const initialQuestions: DraftQuestion[] = [{ id: 1, type: 'single', text: '', options: ['', ''] }]

export function SurveysView({ demo = false, initialSurveyId, isOwner }: { demo?: boolean; initialSurveyId?: string; isOwner: boolean }) {
  const initialSurveys = demo ? demoSurveys.filter((survey) => isOwner || survey.visibility !== 'Privada') : []
  const [surveys, setSurveys] = useState<DemoSurvey[]>(initialSurveys)
  const [selected, setSelected] = useState<DemoSurvey | null>(() => initialSurveys.find((survey) => survey.id === initialSurveyId) ?? null)
  const [editor, setEditor] = useState<'create' | 'edit' | null>(null)
  const [editingSurvey, setEditingSurvey] = useState<DemoSurvey | null>(null)
  const [questions, setQuestions] = useState<DraftQuestion[]>(initialQuestions)
  const [playerQuery, setPlayerQuery] = useState('')
  const player = selected?.visibility === 'Compartida con el equipo' && playerQuery.trim()
    ? demoPlayers.find((candidate) => candidate.name.toLocaleLowerCase().includes(playerQuery.trim().toLocaleLowerCase()))
    : undefined

  function openEditor(mode: 'create' | 'edit', survey: DemoSurvey | null = null) { setQuestions(initialQuestions); setEditingSurvey(survey); if (mode === 'edit') setSelected(null); setEditor(mode) }
  function closeEditor() { setEditor(null); setEditingSurvey(null) }
  function saveSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title')).trim()
    if (!title) return
    const publishNow = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'publish'
    if (editor === 'edit' && editingSurvey) {
      setSurveys((current) => current.map((survey) => survey.id === editingSurvey.id ? { ...survey, title, visibility: String(form.get('visibility')) as DemoSurvey['visibility'], status: publishNow ? 'Activa' : survey.status } : survey))
      setSelected(null)
    } else {
      setSurveys((current) => [{ id: `demo-survey-${Date.now()}`, number: Math.max(0, ...current.map((survey) => survey.number)) + 1, title, visibility: String(form.get('visibility')) as DemoSurvey['visibility'], period: `${String(form.get('startsOn'))} – ${String(form.get('endsOn'))}`, responses: 0, recipients: 18, status: publishNow ? 'Activa' : 'Borrador' }, ...current])
    }
    closeEditor()
  }

  return <section className="page surveys-page">
    <PageHeader eyebrow="GESTIÓN" title="Encuestas" subtitle="Crea, publica y consulta encuestas de la temporada activa." action={<button className="primary-button" onClick={() => openEditor('create')} type="button">Crear encuesta</button>} />
    {!surveys.length && <div className="empty-state"><h2>Aún no hay encuestas</h2><p>Crea un borrador para preparar la primera consulta del equipo.</p></div>}
    {!!surveys.length && <div className="survey-list">{surveys.map((survey) => <button className="survey-card" key={survey.id} onClick={() => { setPlayerQuery(''); setSelected(survey) }} type="button"><span className="survey-number">{survey.number}</span><span className="survey-card-copy"><span className="task-meta"><span>{survey.visibility}</span><span>·</span><span>{survey.status}</span></span><strong>{survey.title}</strong><small>{survey.period} · {survey.responses}/{survey.recipients} respuestas ({participationPercentage(survey.responses, survey.recipients)}%)</small></span></button>)}</div>}

    {editor && <Modal className="survey-editor-dialog" labelledBy="survey-editor-title" onClose={closeEditor} onSubmit={saveSurvey}>
      <div className="panel-form-heading"><div><span className="eyebrow">{editor === 'edit' ? 'BORRADOR' : 'NUEVA ENCUESTA'}</span><h2 id="survey-editor-title">{editor === 'edit' ? 'Editar encuesta' : 'Crear encuesta'}</h2></div><button aria-label="Cerrar editor" className="icon-button" onClick={closeEditor} type="button">×</button></div>
      <div className="form-grid"><label className="full-field">Título<input autoFocus defaultValue={editor === 'edit' ? editingSurvey?.title : ''} name="title" placeholder="Ej. Valoración del viaje" required /></label><label>Inicio<input defaultValue="2026-09-15" name="startsOn" required type="date" /></label><label>Fin<input defaultValue="2026-09-21" name="endsOn" required type="date" /></label><label className="full-field">Visibilidad<select defaultValue={editor === 'edit' ? editingSurvey?.visibility : isOwner ? 'Privada' : 'Gestión'} name="visibility"><option>Compartida con el equipo</option><option>Gestión</option>{isOwner && <option>Privada</option>}</select></label></div>
      <QuestionEditor questions={questions} setQuestions={setQuestions} />
      <button className="secondary-button compact" onClick={() => setQuestions((current) => [...current, { id: current.length + 1, type: 'single', text: '', options: ['', ''] }])} type="button">+ Añadir pregunta</button><div className="form-actions"><button className="secondary-button" onClick={closeEditor} type="button">Cancelar</button><button className="secondary-button" name="action" type="submit" value="draft">Guardar borrador</button><button className="primary-button" name="action" type="submit" value="publish">Publicar encuesta</button></div>
    </Modal>}

    {selected && <Modal className="survey-results-dialog" labelledBy="survey-results-title" onClose={() => setSelected(null)}>
      <div className="panel-form-heading"><div><span className="eyebrow">RESULTADOS {selected.status === 'Activa' ? 'PROVISIONALES' : ''}</span><h2 id="survey-results-title">Encuesta {selected.number} · {selected.title}</h2></div><button aria-label="Cerrar resultados" className="icon-button" onClick={() => setSelected(null)} type="button">×</button></div>
      {selected.status === 'Borrador' ? <div className="survey-draft-summary"><p>Este borrador todavía no tiene respuestas. Puedes revisarlo antes de publicarlo.</p><button className="primary-button" onClick={() => openEditor('edit', selected)} type="button">Editar encuesta</button></div> : <>
        {selected.visibility === 'Compartida con el equipo' && <label className="survey-player-filter">Ver respuestas de una jugadora<span className="survey-filter-input"><input onChange={(event) => setPlayerQuery(event.target.value)} placeholder="Buscar jugadora de la temporada…" value={playerQuery} />{playerQuery && <button aria-label="Quitar filtro de jugadora" onClick={() => setPlayerQuery('')} type="button">×</button>}</span></label>}
        {playerQuery && selected.visibility === 'Compartida con el equipo' ? <PlayerAnswers player={player} query={playerQuery} /> : <AggregatedResults survey={selected} />}
        {(selected.responses > 0 && (!playerQuery || Boolean(player?.responded))) && <div className="form-actions"><button className="secondary-button" onClick={() => window.print()} type="button">Guardar PDF</button></div>}
      </>}
    </Modal>}
  </section>
}

function QuestionEditor({ questions, setQuestions }: { questions: DraftQuestion[]; setQuestions: React.Dispatch<React.SetStateAction<DraftQuestion[]>> }) {
  return <div className="survey-questions-editor"><span className="eyebrow">PREGUNTAS</span>{questions.map((question, index) => <article key={question.id}><b>{index + 1}</b><div><label>Tipo<select value={question.type} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, type: event.target.value as DraftQuestion['type'] } : item))}><option value="long">Respuesta larga</option><option value="single">Una opción</option><option value="multiple">Varias opciones</option></select></label><label>Pregunta<input aria-label={`Pregunta ${index + 1}`} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item))} placeholder="Escribe la pregunta…" required value={question.text} /></label>{question.type !== 'long' && <div className="survey-option-list">{question.options.map((option, optionIndex) => <div className="survey-option-editor" key={optionIndex}><input aria-label={`Opción ${optionIndex + 1} de pregunta ${index + 1}`} onChange={(event) => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: item.options.map((value, valueIndex) => valueIndex === optionIndex ? event.target.value : value) } : item))} placeholder={`Opción ${optionIndex + 1}`} value={option} /><button aria-label={`Quitar opción ${optionIndex + 1} de pregunta ${index + 1}`} className="survey-remove-option" onClick={() => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: item.options.filter((_, valueIndex) => valueIndex !== optionIndex) } : item))} type="button">−</button></div>)}<button className="text-button" onClick={() => setQuestions((current) => current.map((item) => item.id === question.id ? { ...item, options: [...item.options, ''] } : item))} type="button">+ Añadir opción</button></div>}</div></article>)}</div>
}

function AggregatedResults({ survey }: { survey: DemoSurvey }) {
  return <section className="survey-results"><header><p>{survey.responses} de {survey.recipients} jugadoras · {participationPercentage(survey.responses, survey.recipients)}% participación</p></header><article className="survey-result"><b>1</b><div><h3>¿Cómo valoras la semana?</h3>{[['Muy positiva', 9], ['Positiva', 4], ['Mejorable', 1]].map(([label, count]) => <div className="survey-bar" key={label as string}><span>{label as string}<small>{count as number} · {participationPercentage(count as number, survey.responses)}%</small></span><i><em style={{ width: `${participationPercentage(count as number, survey.responses)}%` }} /></i></div>)}</div></article><article className="survey-result"><b>2</b><div><h3>¿Qué mejorarías para la próxima semana?</h3><p>“El grupo ha trabajado con mucha energía.”</p><p>“Me gustaría dedicar más tiempo a la recuperación.”</p></div></article></section>
}

function PlayerAnswers({ player, query }: { player: typeof demoPlayers[number] | undefined; query: string }) {
  if (!player) return <p className="survey-filter-message">No se ha encontrado ninguna jugadora activa llamada “{query}”.</p>
  if (!player.responded) return <p className="survey-filter-message"><strong>{player.name}</strong> no ha respondido a la encuesta.</p>
  return <section className="survey-results"><header><p>Respuestas de <strong>{player.name}</strong></p></header><article className="survey-result"><b>1</b><div><h3>¿Cómo valoras la semana?</h3><p>Muy positiva</p></div></article><article className="survey-result"><b>2</b><div><h3>¿Qué mejorarías para la próxima semana?</h3><p>“Me gustaría dedicar más tiempo a la recuperación.”</p></div></article></section>
}
