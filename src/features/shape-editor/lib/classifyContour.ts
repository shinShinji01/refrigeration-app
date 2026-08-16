import type { Point, Geometry } from '@/shared/lib/geometry'

export const classifyContour = (points: Point[]): Geometry => {
  if (points.length === 4 && isAxisAlignedRect(points as [Point, Point, Point, Point])) {
    const xs = points.map((point) => point.x)
    const ys = points.map((point) => point.y)
    return {
      kind: 'rect',
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    }
  }
  return { kind: 'polygon', vertices: points }
}

// Порядок обхода (по/против часовой, с любого угла) не важен: контур —
// осевой прямоугольник тогда и только тогда, когда его 4 точки — это ровно
// 4 угла своего bounding box, каждый встречается один раз, и bounding box
// не вырожден в линию/точку.
const isAxisAlignedRect = (points: [Point, Point, Point, Point]): boolean => {
  const xs = points.map((point) => point.x)
  const ys = points.map((point) => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  if (minX === maxX || minY === maxY) return false

  const corners = [
    `${minX},${minY}`,
    `${maxX},${minY}`,
    `${maxX},${maxY}`,
    `${minX},${maxY}`,
  ]
  const pointKeys = points.map((point) => `${point.x},${point.y}`)
  return corners.every((corner) => pointKeys.includes(corner)) && new Set(pointKeys).size === 4
}
