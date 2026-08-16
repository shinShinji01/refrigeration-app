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

// Квадратный viewBox по большей стороне bounds + отступ с каждой стороны —
// упрощает zoom/pinch (соотношение сторон канваса всегда 1:1), letterbox
// по короткой стороне рисует SVG сам (preserveAspectRatio по умолчанию).
export const fitScale = (bounds: Bounds): ViewBox => {
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const size = Math.max(contentWidth, contentHeight) * (1 + MARGIN_RATIO * 2)
  const centerX = (bounds.minX + bounds.maxX) / 2
  const centerY = (bounds.minY + bounds.maxY) / 2
  return { x: centerX - size / 2, y: centerY - size / 2, width: size, height: size }
}
