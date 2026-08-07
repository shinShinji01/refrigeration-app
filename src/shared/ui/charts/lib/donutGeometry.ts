export interface DonutGeometryInput {
  id: string
  value: number
}

export interface DonutSegmentGeometry {
  id: string
  dasharray: string
  dashoffset: number
}

const SEGMENT_GAP_PX = 3

// SVG donut без построения path-дуг: каждый сегмент — тот же <circle>,
// у которого stroke-dasharray показывает только его долю окружности,
// а stroke-dashoffset сдвигает начало этой доли на сумму предыдущих.
export const computeDonutGeometry = (
  segments: DonutGeometryInput[],
  circumference: number,
): DonutSegmentGeometry[] => {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0)
  if (total <= 0) return []

  const hasGap = segments.length > 1
  let cumulative = 0

  return segments.map((segment) => {
    const rawLength = (segment.value / total) * circumference
    const length = Math.max(rawLength - (hasGap ? SEGMENT_GAP_PX : 0), 0)
    const dashoffset = cumulative === 0 ? 0 : -cumulative
    cumulative += rawLength
    return { id: segment.id, dasharray: `${length} ${circumference - length}`, dashoffset }
  })
}
