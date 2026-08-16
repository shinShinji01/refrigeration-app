import type { Point } from '@/shared/lib/geometry'

export interface SegmentLabel {
  labelPosition: Point
  angleDeg: number
  lengthMm: number
}

// Нормаль — поворот направляющего вектора на 90° (-dy, dx), одна и та же
// сторона для любого отрезка. Для невыпуклых контуров это не гарантирует
// «снаружи фигуры» в общем случае — сознательный компромисс, см.
// docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md.
export const segmentLabel = (a: Point, b: Point, offsetMm: number): SegmentLabel | null => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthMm = Math.hypot(dx, dy)
  if (lengthMm === 0) return null

  const midX = (a.x + b.x) / 2
  const midY = (a.y + b.y) / 2
  const nx = -dy / lengthMm
  const ny = dx / lengthMm

  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI
  if (angleDeg > 90) angleDeg -= 180
  if (angleDeg < -90) angleDeg += 180

  return {
    labelPosition: { x: midX + nx * offsetMm, y: midY + ny * offsetMm },
    angleDeg,
    lengthMm,
  }
}
