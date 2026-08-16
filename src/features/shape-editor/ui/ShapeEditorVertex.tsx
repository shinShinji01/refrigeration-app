import clsx from 'clsx'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Point } from '@/shared/lib/geometry'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorVertexProps {
  point: Point
  index: number
  radiusMm: number
  hitRadiusMm: number
  invalid: boolean
  draggable: boolean
  onHandlePointerDown: (event: ReactPointerEvent<SVGCircleElement>) => void
  onHandlePointerMove: (event: ReactPointerEvent<SVGCircleElement>) => void
  onHandlePointerUp: (event: ReactPointerEvent<SVGCircleElement>) => void
}

// Два круга в одной точке: невидимый несёт весь drag и держит тач-таргет
// ≥44px (CLAUDE.md) независимо от того, насколько компактно рисуется видимый —
// см. docs/superpowers/specs/2026-08-16-shape-editor-measurements-design.md.
// Ручку драга рендерим только когда контур уже closed (draggable=true): пока
// контур ещё рисуется, редьюсер всё равно игнорирует vertex-moved (см.
// editorReducer.ts), а ~44px хит-зона поверх ещё не поставленной точки
// перехватывала бы тап и создавала мёртвую зону для point-added.
export const ShapeEditorVertex = ({
  point,
  index,
  radiusMm,
  hitRadiusMm,
  invalid,
  draggable,
  onHandlePointerDown,
  onHandlePointerMove,
  onHandlePointerUp,
}: ShapeEditorVertexProps) => (
  <g>
    {draggable ? (
      <circle
        data-testid={`shape-editor-handle-${index}`}
        className={styles.vertexHandle}
        cx={point.x}
        cy={point.y}
        r={hitRadiusMm}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
      />
    ) : null}
    <circle
      data-testid={`shape-editor-vertex-${index}`}
      className={clsx(styles.vertex, invalid && styles.vertexInvalid)}
      cx={point.x}
      cy={point.y}
      r={radiusMm}
    />
  </g>
)
