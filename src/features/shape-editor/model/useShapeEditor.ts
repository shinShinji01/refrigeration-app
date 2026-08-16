import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { Geometry, Point } from '@/shared/lib/geometry'
import {
  editorReducer,
  geometryEquals,
  geometryFromState,
  initEditorState,
  type EditorState,
  type EditorAction,
} from '../lib/editorReducer'
import { fitScale, type ViewBox } from '../lib/fitScale'
import { boundsOfPoints } from '../lib/boundsOfPoints'
import { clientToMm } from '../lib/clientToMm'
import { GRID_STEP_MM, snapToGrid } from '../lib/snapToGrid'

const ZOOM_STEP_FACTOR = 1.25
const MIN_VIEWBOX_SIZE_MM = 20
const MAX_VIEWBOX_SIZE_MM = 20_000

// Реальная ширина канваса в px — CSS даёт только max-width:360px, на телефоне
// контейнер часто уже. Нужна, чтобы маркеры вершин имели постоянный размер на
// экране при любом зуме/размере фигуры, а не фиксированный размер в мм чертежа
// (см. docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md).
const DEFAULT_CANVAS_PIXEL_SIZE = 360
const VERTEX_VISIBLE_RADIUS_PX = 6
const VERTEX_HIT_RADIUS_PX = 22 // диаметр 44px — тач-таргет, CLAUDE.md

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
  manualViewBox: ViewBox | null
  svgRef: React.RefObject<SVGSVGElement | null>
  canClose: boolean
  vertexRadiusMm: number
  vertexHitRadiusMm: number
  handlePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
  handleWheel: (event: ReactWheelEvent<SVGSVGElement>) => void
  zoomIn: () => void
  zoomOut: () => void
  resetZoom: () => void
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))
  const svgRef = useRef<SVGSVGElement>(null)

  const [canvasPixelSize, setCanvasPixelSize] = useState(DEFAULT_CANVAS_PIXEL_SIZE)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width
      if (width) setCanvasPixelSize(width)
    })
    observer.observe(svg)
    return () => observer.disconnect()
  }, [])

  // Внешнее изменение value (другой кусок, сброс формы) — синхронизируем
  // внутреннее состояние. Сравнение по ссылке отличает «нас попросили
  // измениться извне» от «мы сами только что вызвали onChange», т.к.
  // родитель (react-hook-form Controller) отражает ровно тот же объект
  // обратно в value, пока ничего другого не произошло.
  useEffect(() => {
    if (value === lastSyncedValueRef.current) return
    lastSyncedValueRef.current = value
    dispatch({ type: 'value-synced', geometry: value })
  }, [value])

  const geometry = geometryFromState(state)
  useEffect(() => {
    // Пока контур самопересекается, наружу не должно уходить ничего — ни
    // валидная геометрия, ни null: снаружи всегда лежит последняя валидная
    // геометрия (design-спек 2026-08-15-shape-editor-design.md, строки 127-130).
    // Без этой проверки переход closed(valid) → closed(intersecting) выглядит
    // для эффекта неотличимо от «Очистить» (geometry меняется на null) и
    // ошибочно вызывает onChange(null) во время драга вершины.
    if (state.intersecting) return
    if (lastSyncedValueRef.current !== value) return // синхронизация извне ещё не применилась к state
    if (geometryEquals(geometry, lastEmittedRef.current)) return
    lastEmittedRef.current = geometry
    onChange(geometry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  const bounds = useMemo(() => boundsOfPoints(state.points), [state.points])
  const autoViewBox = useMemo(() => fitScale(bounds), [bounds])
  const [manualViewBox, setManualViewBox] = useState<ViewBox | null>(null)
  const viewBox = manualViewBox ?? autoViewBox

  const mmPerPx = viewBox.width / canvasPixelSize
  const vertexRadiusMm = VERTEX_VISIBLE_RADIUS_PX * mmPerPx
  const vertexHitRadiusMm = VERTEX_HIT_RADIUS_PX * mmPerPx

  const applyZoom = (factor: number) => {
    const base = manualViewBox ?? autoViewBox
    const centerX = base.x + base.width / 2
    const centerY = base.y + base.height / 2
    const width = Math.min(Math.max(base.width / factor, MIN_VIEWBOX_SIZE_MM), MAX_VIEWBOX_SIZE_MM)
    const height = Math.min(Math.max(base.height / factor, MIN_VIEWBOX_SIZE_MM), MAX_VIEWBOX_SIZE_MM)
    setManualViewBox({ x: centerX - width / 2, y: centerY - height / 2, width, height })
  }

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    applyZoom(event.deltaY < 0 ? ZOOM_STEP_FACTOR : 1 / ZOOM_STEP_FACTOR)
  }

  const dragStartRef = useRef<Point | null>(null)
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartDistanceRef = useRef<number | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointersRef.current.size === 2) {
      const [a, b] = [...activePointersRef.current.values()]
      pinchStartDistanceRef.current = Math.hypot(a!.x - b!.x, a!.y - b!.y)
      dragStartRef.current = null
      return
    }
    if (state.status === 'closed') return
    const svg = svgRef.current
    if (!svg) return
    dragStartRef.current = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointersRef.current.size !== 2 || pinchStartDistanceRef.current === null) return
    const [a, b] = [...activePointersRef.current.values()]
    const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y)
    const factor = distance / pinchStartDistanceRef.current
    if (Math.abs(factor - 1) < 0.02) return // шум жеста — не зумим на дрожание пальцев
    applyZoom(factor)
    pinchStartDistanceRef.current = distance
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    activePointersRef.current.delete(event.pointerId)
    if (activePointersRef.current.size < 2) pinchStartDistanceRef.current = null

    if (state.status === 'closed') {
      dragStartRef.current = null
      return
    }
    const start = dragStartRef.current
    dragStartRef.current = null
    if (!start) return
    const svg = svgRef.current
    if (!svg) return

    const end = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
    const distanceMm = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y))
    const isDrag = distanceMm >= GRID_STEP_MM

    if (isDrag && state.points.length === 0) {
      dispatch({ type: 'rect-drawn', corner1: snapToGrid(start), corner2: snapToGrid(end) })
      return
    }
    dispatch({ type: 'point-added', point: snapToGrid(end) })
  }

  return {
    state,
    dispatch,
    viewBox,
    manualViewBox,
    svgRef,
    canClose: state.points.length >= 3,
    vertexRadiusMm,
    vertexHitRadiusMm,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    zoomIn: () => applyZoom(ZOOM_STEP_FACTOR),
    zoomOut: () => applyZoom(1 / ZOOM_STEP_FACTOR),
    resetZoom: () => setManualViewBox(null),
  }
}
