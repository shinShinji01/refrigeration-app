// Координаты в миллиметрах, начало — левый верхний угол ограничивающего
// прямоугольника, ось Y вниз. См. docs/data-model.md → "Геометрия куска".
export interface Point {
  x: number
  y: number
}

export type Geometry =
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'polygon'; vertices: Point[] }
