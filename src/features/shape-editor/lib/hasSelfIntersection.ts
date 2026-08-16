import type { Point } from '@/shared/lib/geometry'

export const hasSelfIntersection = (points: Point[]): boolean => {
  const n = points.length
  if (n < 4) return false // треугольник самопересечься не может

  for (let i = 0; i < n; i++) {
    const a1 = points[i]!
    const a2 = points[(i + 1) % n]!
    for (let j = i + 1; j < n; j++) {
      const sharesVertex = j === i || j === (i + 1) % n || (j + 1) % n === i
      if (sharesVertex) continue
      const b1 = points[j]!
      const b2 = points[(j + 1) % n]!
      if (segmentsIntersect(a1, a2, b1, b2)) return true
    }
  }
  return false
}

const orientation = (p: Point, q: Point, r: Point): number => {
  const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y)
  if (value === 0) return 0
  return value > 0 ? 1 : 2
}

const onSegment = (p: Point, q: Point, r: Point): boolean =>
  q.x <= Math.max(p.x, r.x) &&
  q.x >= Math.min(p.x, r.x) &&
  q.y <= Math.max(p.y, r.y) &&
  q.y >= Math.min(p.y, r.y)

const segmentsIntersect = (p1: Point, q1: Point, p2: Point, q2: Point): boolean => {
  const o1 = orientation(p1, q1, p2)
  const o2 = orientation(p1, q1, q2)
  const o3 = orientation(p2, q2, p1)
  const o4 = orientation(p2, q2, q1)

  if (o1 !== o2 && o3 !== o4) return true

  if (o1 === 0 && onSegment(p1, p2, q1)) return true
  if (o2 === 0 && onSegment(p1, q2, q1)) return true
  if (o3 === 0 && onSegment(p2, p1, q2)) return true
  if (o4 === 0 && onSegment(p2, q1, q2)) return true

  return false
}
