import type { Point } from '@/shared/lib/geometry'

export const GRID_STEP_MM = 5

export const snapToGrid = (point: Point): Point => ({
  x: Math.round(point.x / GRID_STEP_MM) * GRID_STEP_MM,
  y: Math.round(point.y / GRID_STEP_MM) * GRID_STEP_MM,
})
