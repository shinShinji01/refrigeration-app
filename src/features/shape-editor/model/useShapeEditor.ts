import { useEffect, useMemo, useReducer, useRef } from 'react'
import type { Geometry } from '@/shared/lib/geometry'
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

export interface UseShapeEditorResult {
  state: EditorState
  dispatch: (action: EditorAction) => void
  viewBox: ViewBox
}

export const useShapeEditor = (
  value: Geometry | null,
  onChange: (geometry: Geometry | null) => void,
): UseShapeEditorResult => {
  const [state, dispatch] = useReducer(editorReducer, value, initEditorState)
  const lastSyncedValueRef = useRef<Geometry | null>(value)
  const lastEmittedRef = useRef<Geometry | null>(geometryFromState(state))

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
    if (lastSyncedValueRef.current !== value) return // синхронизация извне ещё не применилась к state
    if (geometryEquals(geometry, lastEmittedRef.current)) return
    lastEmittedRef.current = geometry
    onChange(geometry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry])

  const bounds = useMemo(() => boundsOfPoints(state.points), [state.points])
  const viewBox = useMemo(() => fitScale(bounds), [bounds])

  return { state, dispatch, viewBox }
}
