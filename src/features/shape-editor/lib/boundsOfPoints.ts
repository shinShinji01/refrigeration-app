import type { Point } from '@/shared/lib/geometry'
import type { Bounds } from './fitScale'

export const DEFAULT_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 200, maxY: 200 }

export const boundsOfPoints = (points: Point[]): Bounds => {
  if (points.length === 0) return DEFAULT_BOUNDS
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}
