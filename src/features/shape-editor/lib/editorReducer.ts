import type { Point, Geometry } from '@/shared/lib/geometry'
import { classifyContour } from './classifyContour'
import { hasSelfIntersection } from './hasSelfIntersection'

export type DrawingStatus = 'empty' | 'drawing' | 'closed'

export interface EditorState {
  points: Point[]
  status: DrawingStatus
  intersecting: boolean
}

export type EditorAction =
  | { type: 'point-added'; point: Point }
  | { type: 'closed-by-button' }
  | { type: 'rect-drawn'; corner1: Point; corner2: Point }
  | { type: 'last-point-undone' }
  | { type: 'cleared' }
  | { type: 'vertex-moved'; index: number; point: Point }
  | { type: 'value-synced'; geometry: Geometry | null }

const geometryToPoints = (geometry: Geometry | null): Point[] => {
  if (!geometry) return []
  if (geometry.kind === 'polygon') return geometry.vertices
  const { width, height } = geometry
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

export const initEditorState = (geometry: Geometry | null): EditorState => {
  const points = geometryToPoints(geometry)
  return { points, status: points.length > 0 ? 'closed' : 'empty', intersecting: false }
}

const closeIfValid = (points: Point[]): EditorState => {
  const intersecting = hasSelfIntersection(points)
  return { points, status: intersecting ? 'drawing' : 'closed', intersecting }
}

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  switch (action.type) {
    case 'point-added': {
      if (state.status === 'closed') return state
      const first = state.points[0]
      const isClosingTap =
        state.points.length >= 3 &&
        first !== undefined &&
        first.x === action.point.x &&
        first.y === action.point.y
      if (isClosingTap) return closeIfValid(state.points)
      const newPoints = [...state.points, action.point]
      // Пересчитываем intersecting эагерно при каждом добавлении точки (не только
      // в момент явного замыкания) — это даёт живую подсказку «замкнётся ли контур
      // без самопересечения прямо сейчас». Отклонение от буквального сниппета брифа
      // (там `intersecting: false`) необходимо: тест «замыкание в самопересекающийся
      // контур» тапает не в points[0], попадает в эту ветку, и с хардкодом false
      // не прошёл бы. Учитывайте это поведение в задачах 7-11.
      return { points: newPoints, status: 'drawing', intersecting: hasSelfIntersection(newPoints) }
    }
    case 'closed-by-button': {
      if (state.points.length < 3) return state
      return closeIfValid(state.points)
    }
    case 'rect-drawn': {
      if (state.points.length > 0) return state
      const { corner1, corner2 } = action
      if (corner1.x === corner2.x || corner1.y === corner2.y) return state
      return {
        points: [
          { x: corner1.x, y: corner1.y },
          { x: corner2.x, y: corner1.y },
          { x: corner2.x, y: corner2.y },
          { x: corner1.x, y: corner2.y },
        ],
        status: 'closed',
        intersecting: false,
      }
    }
    case 'last-point-undone': {
      if (state.points.length === 0) return state
      const points = state.points.slice(0, -1)
      return { points, status: points.length > 0 ? 'drawing' : 'empty', intersecting: false }
    }
    case 'cleared':
      return state.points.length === 0 ? state : { points: [], status: 'empty', intersecting: false }
    case 'vertex-moved': {
      // Защита инварианта «closed ⇒ ≥3 точек»: перемещение вершины имеет смысл
      // только для уже замкнутого контура. Если состояние 'empty' или 'drawing',
      // игнорируем действие вместо того, чтобы принудительно выставлять 'closed'.
      if (state.status !== 'closed') return state
      const points = state.points.map((point, index) => (index === action.index ? action.point : point))
      return { points, status: 'closed', intersecting: hasSelfIntersection(points) }
    }
    case 'value-synced':
      return initEditorState(action.geometry)
    default:
      return state
  }
}

export const geometryFromState = (state: EditorState): Geometry | null =>
  state.status === 'closed' && !state.intersecting ? classifyContour(state.points) : null

export const geometryEquals = (a: Geometry | null, b: Geometry | null): boolean => {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a.kind !== b.kind) return false
  if (a.kind === 'rect' && b.kind === 'rect') return a.width === b.width && a.height === b.height
  if (a.kind === 'polygon' && b.kind === 'polygon') {
    if (a.vertices.length !== b.vertices.length) return false
    return a.vertices.every(
      (point, index) => point.x === b.vertices[index]!.x && point.y === b.vertices[index]!.y,
    )
  }
  return false
}
