import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
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

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
  svgRef: React.RefObject<SVGSVGElement | null>
  canClose: boolean
  handlePointerDown: (event: ReactPointerEvent<SVGSVGElement>) => void
  handlePointerUp: (event: ReactPointerEvent<SVGSVGElement>) => void
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))
  const svgRef = useRef<SVGSVGElement>(null)

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
  const viewBox = useMemo(() => fitScale(bounds), [bounds])

  const dragStartRef = useRef<Point | null>(null)

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (state.status === 'closed') return
    const svg = svgRef.current
    if (!svg) return
    dragStartRef.current = clientToMm(event.clientX, event.clientY, svg.getBoundingClientRect(), viewBox)
  }

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
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

  return { state, dispatch, viewBox, svgRef, canClose: state.points.length >= 3, handlePointerDown, handlePointerUp }
}
