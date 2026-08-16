import { computeArea } from '@/shared/lib/geometry'
import { geometryFromState, type EditorState } from './editorReducer'

export const formatReadout = (state: EditorState): string => {
  if (state.status === 'empty' || state.status === 'drawing') {
    const remaining = Math.max(3 - state.points.length, 0)
    return remaining > 0 ? `Поставьте ещё ${remaining} точки` : 'Можно замкнуть'
  }
  const geometry = geometryFromState(state)
  if (!geometry) return 'Самопересечение — исправьте контур'
  const areaM2 = Number((computeArea(geometry) / 1_000_000).toFixed(2))
  if (geometry.kind === 'rect') return `rect ${geometry.width}×${geometry.height} мм · ${areaM2} м²`
  return `polygon · ${areaM2} м²`
}
