export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ViewBox {
  x: number
  y: number
  width: number
  height: number
}

const MARGIN_RATIO = 0.15

// Вершины рисуются фиксированным радиусом 4мм (см. ShapeEditor.tsx) независимо
// от масштаба — если content схлопнуть меньше этого, один маркер вершины
// перекрывает весь канвас. 20мм — тот же порог, что и ручной зум-минимум
// (MIN_VIEWBOX_SIZE_MM в useShapeEditor.ts), не даёт auto-fit уйти теснее.
const MIN_CONTENT_SIZE_MM = 20

// Квадратный viewBox по большей стороне bounds + отступ с каждой стороны —
// упрощает zoom/pinch (соотношение сторон канваса всегда 1:1), letterbox
// по короткой стороне рисует SVG сам (preserveAspectRatio по умолчанию).
export const fitScale = (bounds: Bounds): ViewBox => {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, MIN_CONTENT_SIZE_MM)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, MIN_CONTENT_SIZE_MM)
  const size = Math.max(contentWidth, contentHeight) * (1 + MARGIN_RATIO * 2)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return { x: centerX - size / 2, y: centerY - size / 2, width: size, height: size }
}
