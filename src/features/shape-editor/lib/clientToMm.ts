import type { Point } from '@/shared/lib/geometry'
import type { ViewBox } from './fitScale'

export interface ClientRect {
  left: number
  top: number
  width: number
  height: number
}

export const clientToMm = (clientX: number, clientY: number, rect: ClientRect, viewBox: ViewBox): Point => {
  const xRatio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
  const yRatio = rect.height === 0 ? 0 : (clientY - rect.top) / rect.height
  return { x: viewBox.x + xRatio * viewBox.width, y: viewBox.y + yRatio * viewBox.height }
}
