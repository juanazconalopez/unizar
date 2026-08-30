import { useEffect, useMemo, useRef, useState } from 'react'
import { Arrow, Circle, Ellipse, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { Modal } from '../../components/ui/Modal'
import type { TacticsBoardData, TacticsElement, TacticsElementType } from '../../types'

const BOARD_WIDTH = 900
const BOARD_HEIGHT = 520

const toolLabels: { type: TacticsElementType; label: string }[] = [
  { type: 'player', label: 'Jugadora' },
  { type: 'opponent', label: 'Rival' },
  { type: 'cone', label: 'Cono' },
  { type: 'ball', label: 'Balón' },
  { type: 'shield', label: 'Escudo' },
  { type: 'run', label: 'Carrera' },
  { type: 'pass', label: 'Pase' },
  { type: 'defense', label: 'Defensa' },
  { type: 'zone', label: 'Zona' },
  { type: 'text', label: 'Texto' },
]

export function TacticsBoardPreview({ data, label }: { data: TacticsBoardData; label: string }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(BOARD_WIDTH)

  useEffect(() => {
    const container = wrapRef.current
    if (!container) return
    const resize = () => setWidth(Math.min(BOARD_WIDTH, Math.max(260, container.clientWidth)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const scale = width / BOARD_WIDTH
  return (
    <div aria-label={label} className="tactics-preview" ref={wrapRef} role="img">
      <Stage height={BOARD_HEIGHT * scale} listening={false} scaleX={scale} scaleY={scale} width={width}>
        <Layer listening={false}>
          <Pitch template={data.template} />
          {data.elements.map((element) => (
            <Group key={element.id} rotation={element.rotation ?? 0} scaleX={element.scaleX ?? 1} scaleY={element.scaleY ?? 1} x={element.x} y={element.y}>
              <ElementShape element={element} />
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  )
}

export function TacticsBoard({ initialData, exerciseTitle, onCancel, onSave }: {
  initialData: TacticsBoardData
  exerciseTitle: string
  onCancel: () => void
  onSave: (data: TacticsBoardData) => void
}) {
  const [board, setBoard] = useState<TacticsBoardData>(() => structuredClone(initialData))
  const [past, setPast] = useState<TacticsBoardData[]>([])
  const [future, setFuture] = useState<TacticsBoardData[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [canvasWidth, setCanvasWidth] = useState(BOARD_WIDTH)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<Konva.Stage>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const elementNodes = useRef(new Map<string, Konva.Group>())
  const nextElementId = useRef(initialData.elements.length)
  const scale = canvasWidth / BOARD_WIDTH

  useEffect(() => {
    const container = canvasWrapRef.current
    if (!container) return
    const resize = () => setCanvasWidth(Math.min(BOARD_WIDTH, Math.max(280, container.clientWidth)))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const selected = useMemo(
    () => board.elements.find((element) => element.id === selectedId),
    [board.elements, selectedId],
  )

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = selectedId ? elementNodes.current.get(selectedId) : undefined
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedId, board.elements])

  function commit(next: TacticsBoardData) {
    setPast((items) => [...items.slice(-29), structuredClone(board)])
    setBoard(next)
    setFuture([])
  }

  function addElement(type: TacticsElementType) {
    let label: string | undefined
    if (type === 'player') label = String(board.elements.filter((item) => item.type === 'player').length + 1)
    if (type === 'opponent') label = String(board.elements.filter((item) => item.type === 'opponent').length + 1)
    if (type === 'text') {
      const entered = window.prompt('Texto para el esquema')?.trim()
      if (!entered) return
      label = entered
    }
    const offset = (board.elements.length % 8) * 22
    const element: TacticsElement = {
      id: `tactics-element-${++nextElementId.current}`,
      type,
      x: type === 'zone' ? 330 : 360 + offset,
      y: type === 'zone' ? 205 : 220 + (offset % 70),
      rotation: 0,
      ...(label ? { label } : {}),
    }
    commit({ ...board, elements: [...board.elements, element] })
    setSelectedId(element.id)
  }

  function updateElement(id: string, changes: Partial<TacticsElement>) {
    commit({
      ...board,
      elements: board.elements.map((element) => element.id === id ? { ...element, ...changes } : element),
    })
  }

  function moveElement(id: string, event: KonvaEventObject<DragEvent>) {
    updateElement(id, { x: event.target.x(), y: event.target.y() })
  }

  function transformElement(id: string, event: KonvaEventObject<Event>) {
    const node = event.target
    updateElement(id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      scaleX: clamp(Math.abs(node.scaleX()), 0.4, 3),
      scaleY: clamp(Math.abs(node.scaleY()), 0.4, 3),
    })
  }

  function undo() {
    const previous = past.at(-1)
    if (!previous) return
    setFuture((items) => [structuredClone(board), ...items].slice(0, 30))
    setPast((items) => items.slice(0, -1))
    setBoard(previous)
    setSelectedId(null)
  }

  function redo() {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, structuredClone(board)].slice(-30))
    setFuture((items) => items.slice(1))
    setBoard(next)
    setSelectedId(null)
  }

  function removeSelected() {
    if (!selectedId) return
    commit({ ...board, elements: board.elements.filter((element) => element.id !== selectedId) })
    setSelectedId(null)
  }

  function rotateSelected(degrees: number) {
    if (!selected) return
    updateElement(selected.id, { rotation: (selected.rotation ?? 0) + degrees })
  }

  function resizeSelected(multiplier: number, horizontalOnly = false) {
    if (!selected) return
    const scaleX = clamp((selected.scaleX ?? 1) * multiplier, 0.4, 3)
    const scaleY = horizontalOnly
      ? selected.scaleY ?? 1
      : clamp((selected.scaleY ?? 1) * multiplier, 0.4, 3)
    updateElement(selected.id, { scaleX, scaleY })
  }

  function downloadImage() {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2 })
    if (!dataUrl) return
    const link = document.createElement('a')
    link.download = `${exerciseTitle.trim() || 'esquema-entrenamiento'}.png`
    link.href = dataUrl
    link.click()
  }

  return (
    <Modal className="tactics-dialog" labelledBy="tactics-board-title" onClose={onCancel}>
      <div className="tactics-heading">
        <div><span className="eyebrow">PIZARRA TÁCTICA</span><h2 id="tactics-board-title">{exerciseTitle || 'Esquema del ejercicio'}</h2></div>
        <button aria-label="Cerrar pizarra" className="icon-button" onClick={onCancel} type="button">×</button>
      </div>

      <div className="tactics-controls">
        <label>Campo
          <select value={board.template} onChange={(event) => commit({ ...board, template: event.target.value as TacticsBoardData['template'] })}>
            <option value="full">Campo completo</option>
            <option value="half">Medio campo</option>
            <option value="22">Zona de 22</option>
          </select>
        </label>
        <div className="tactics-history">
          <button className="secondary-button compact" disabled={!past.length} onClick={undo} type="button">Deshacer</button>
          <button className="secondary-button compact" disabled={!future.length} onClick={redo} type="button">Rehacer</button>
          <button className="secondary-button compact" onClick={downloadImage} type="button">Exportar PNG</button>
        </div>
      </div>

      <div className="tactics-workspace">
        <div className="tactics-palette" aria-label="Elementos deportivos">
          {toolLabels.map((tool) => (
            <button key={tool.type} onClick={() => addElement(tool.type)} type="button">
              <ToolSwatch type={tool.type} /><span>{tool.label}</span>
            </button>
          ))}
        </div>
        <div className="tactics-canvas-wrap" ref={canvasWrapRef}>
          <Stage
            height={BOARD_HEIGHT * scale}
            onPointerDown={(event) => { if (event.target === event.target.getStage()) setSelectedId(null) }}
            ref={stageRef}
            scaleX={scale}
            scaleY={scale}
            width={canvasWidth}
          >
            <Layer>
              <Pitch template={board.template} />
              {board.elements.map((element) => (
                <BoardElement
                  element={element}
                  key={element.id}
                  onMove={moveElement}
                  onNode={(node) => {
                    if (node) elementNodes.current.set(element.id, node)
                    else elementNodes.current.delete(element.id)
                  }}
                  onSelect={setSelectedId}
                  onTransform={transformElement}
                />
              ))}
              <Transformer
                anchorCornerRadius={8}
                anchorFill="#ffe36f"
                anchorSize={18}
                anchorStroke="#07513c"
                borderDash={[7, 5]}
                borderStroke="#ffe36f"
                borderStrokeWidth={2}
                boundBoxFunc={(oldBox, newBox) => {
                  const arrow = selected ? isArrowType(selected.type) : false
                  if (Math.abs(newBox.width) < (arrow ? 45 : 20)) return oldBox
                  if (!arrow && Math.abs(newBox.height) < 20) return oldBox
                  return newBox
                }}
                enabledAnchors={selected && isArrowType(selected.type)
                  ? ['middle-left', 'middle-right']
                  : selected?.type === 'zone'
                    ? ['top-left', 'top-center', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center', 'bottom-right']
                    : ['top-left', 'top-right', 'bottom-left', 'bottom-right']}
                flipEnabled={false}
                keepRatio={selected?.type !== 'zone'}
                padding={8}
                ref={transformerRef}
                rotateAnchorOffset={24}
              />
            </Layer>
          </Stage>
        </div>
      </div>

      <div className="tactics-selection" aria-live="polite">
        {selected ? <>
          <span>Seleccionado: <strong>{elementName(selected)}</strong>. Arrastra los tiradores amarillos para redimensionar.</span>
          <button className="secondary-button compact" onClick={() => resizeSelected(0.85)} type="button">− Tamaño</button>
          <button className="secondary-button compact" onClick={() => resizeSelected(1.18)} type="button">+ Tamaño</button>
          {isArrowType(selected.type) && <>
            <button className="secondary-button compact" onClick={() => resizeSelected(0.82, true)} type="button">Acortar</button>
            <button className="secondary-button compact" onClick={() => resizeSelected(1.22, true)} type="button">Alargar</button>
          </>}
          <button className="secondary-button compact" onClick={() => rotateSelected(-15)} type="button">↺ Girar</button>
          <button className="secondary-button compact" onClick={() => rotateSelected(15)} type="button">Girar ↻</button>
          <button className="danger-button compact" onClick={removeSelected} type="button">Eliminar</button>
        </> : <span>Selecciona un elemento para moverlo, redimensionarlo, girarlo o eliminarlo.</span>}
      </div>

      <div className="form-actions tactics-actions">
        <button className="secondary-button" onClick={onCancel} type="button">Cancelar</button>
        <button className="primary-button" onClick={() => onSave(board)} type="button">Guardar esquema</button>
      </div>
    </Modal>
  )
}

function Pitch({ template }: { template: TacticsBoardData['template'] }) {
  const label = template === 'full' ? 'CAMPO COMPLETO' : template === 'half' ? 'MEDIO CAMPO' : 'ZONA DE 22'
  return <>
    <Rect fill="#176b46" height={BOARD_HEIGHT} width={BOARD_WIDTH} />
    <Rect fill="#237b54" height={480} stroke="#f4f0d0" strokeWidth={3} width={860} x={20} y={20} />
    <Line points={[450, 20, 450, 500]} stroke="#f4f0d0" strokeWidth={2} />
    <Line dash={[9, 9]} points={[220, 20, 220, 500]} stroke="#dce9d2" strokeWidth={2} />
    <Line dash={[9, 9]} points={[680, 20, 680, 500]} stroke="#dce9d2" strokeWidth={2} />
    <Line points={[100, 20, 100, 500]} stroke="#f4f0d0" strokeWidth={2} />
    <Line points={[800, 20, 800, 500]} stroke="#f4f0d0" strokeWidth={2} />
    <Line dash={[5, 11]} points={[335, 20, 335, 500]} stroke="#dce9d2" strokeWidth={1} />
    <Line dash={[5, 11]} points={[565, 20, 565, 500]} stroke="#dce9d2" strokeWidth={1} />
    <Text fill="rgba(255,255,255,.55)" fontSize={13} fontStyle="bold" text={label} x={35} y={34} />
  </>
}

function BoardElement({ element, onMove, onNode, onSelect, onTransform }: {
  element: TacticsElement
  onMove: (id: string, event: KonvaEventObject<DragEvent>) => void
  onNode: (node: Konva.Group | null) => void
  onSelect: (id: string) => void
  onTransform: (id: string, event: KonvaEventObject<Event>) => void
}) {
  return (
    <Group
      draggable
      onClick={() => onSelect(element.id)}
      onDragEnd={(event) => onMove(element.id, event)}
      onPointerDown={() => onSelect(element.id)}
      onTap={() => onSelect(element.id)}
      onTransformEnd={(event) => onTransform(element.id, event)}
      ref={onNode}
      rotation={element.rotation ?? 0}
      scaleX={element.scaleX ?? 1}
      scaleY={element.scaleY ?? 1}
      x={element.x}
      y={element.y}
    >
      <ElementShape element={element} />
    </Group>
  )
}

function ElementShape({ element }: { element: TacticsElement }) {
  if (element.type === 'player' || element.type === 'opponent') {
    const own = element.type === 'player'
    return <><Circle fill={own ? '#f1c84b' : '#7254a8'} radius={15} stroke="white" strokeWidth={2} /><Text align="center" fill={own ? '#173c2e' : 'white'} fontSize={11} fontStyle="bold" height={16} text={element.label ?? ''} width={30} x={-15} y={-6} /></>
  }
  if (element.type === 'cone') return <Line closed fill="#ff8b32" points={[-11, 12, 0, -13, 11, 12]} stroke="white" strokeWidth={1.5} />
  if (element.type === 'ball') return <><Ellipse fill="#f5e5c7" radiusX={14} radiusY={8} rotation={-22} stroke="#683d28" strokeWidth={1.5} /><Line points={[-5, -2, 5, 2]} rotation={-22} stroke="#683d28" /></>
  if (element.type === 'shield') return <Rect cornerRadius={5} fill="#286d91" height={32} stroke="white" strokeWidth={2} width={22} x={-11} y={-16} />
  if (element.type === 'zone') return <Rect cornerRadius={7} fill="rgba(255,220,84,.28)" height={60} stroke="#ffe36f" strokeWidth={2} width={120} />
  if (element.type === 'text') return <Text fill="white" fontSize={16} fontStyle="bold" shadowColor="#173c2e" shadowBlur={3} text={element.label ?? 'Texto'} />
  const style = arrowStyle(element.type)
  return <Arrow dash={style.dash} fill={style.color} pointerLength={11} pointerWidth={10} points={[0, 0, 105, 0]} stroke={style.color} strokeWidth={4} />
}

function arrowStyle(type: TacticsElementType) {
  if (type === 'pass') return { color: '#8ed8ff', dash: [12, 8] }
  if (type === 'defense') return { color: '#ff9f93', dash: [4, 6] }
  return { color: '#ffe36f', dash: undefined }
}

function ToolSwatch({ type }: { type: TacticsElementType }) {
  const symbols: Record<TacticsElementType, string> = {
    player: '●', opponent: '●', cone: '▲', ball: '⬭', shield: '▮',
    run: '➜', pass: '⇢', defense: '⇢', zone: '▧', text: 'T',
  }
  return <i className={`tactics-tool-${type}`}>{symbols[type]}</i>
}

function elementName(element: TacticsElement) {
  return toolLabels.find((tool) => tool.type === element.type)?.label ?? 'Elemento'
}

function isArrowType(type: TacticsElementType) {
  return type === 'run' || type === 'pass' || type === 'defense'
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
