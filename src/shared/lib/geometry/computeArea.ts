import type { Geometry, Point } from './types'

export const computeArea = (geometry: Geometry): number => {
  if (geometry.kind === 'rect') return geometry.width * geometry.height
  return shoelaceArea(geometry.vertices)
}

// Формула шнурков: |Σ(x_i·y_{i+1} − x_{i+1}·y_i)| / 2, см. docs/data-model.md.
const shoelaceArea = (vertices: Point[]): number => {
  let sum = 0
  for (let i = 0; i < vertices.length; i++) {
    const current = vertices[i]!
    const next = vertices[(i + 1) % vertices.length]!
    sum += current.x * next.y - next.x * current.y
  }
  return Math.abs(sum) / 2
}
