import clsx from 'clsx'
import type { Geometry } from '@/shared/lib/geometry'
import { useShapeEditor } from '../model/useShapeEditor'
import { formatReadout } from '../lib/formatReadout'
import { GRID_STEP_MM } from '../lib/snapToGrid'
import styles from './ShapeEditor.module.scss'

interface ShapeEditorProps {
  value: Geometry | null
  onChange: (geometry: Geometry | null) => void
}

// Литеральные линии сетки каждые 5мм как отдельные SVG-элементы дали бы
// сотни/тысячи узлов DOM на крупных кусках (метры) — вместо этого тайлим
// <pattern> фиксированного мм-размера, число DOM-узлов не зависит от
// размера контура и зума. Числовые подписи на линиях — не в этой версии,
// точные размеры и так видны в живом отчёте под канвасом.
const GRID_MAJOR_STEP_MM = GRID_STEP_MM * 10

export const ShapeEditor = ({ value, onChange }: ShapeEditorProps) => {
  const { state, viewBox } = useShapeEditor(value, onChange)
  const readout = formatReadout(state)
  const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points

  return (
    <div className={styles.root}>
      <svg
        className={styles.canvas}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Редактор геометрии куска"
        data-testid="shape-editor-canvas"
      >
        <defs>
          <pattern id="grid-minor" width={GRID_STEP_MM} height={GRID_STEP_MM} patternUnits="userSpaceOnUse">
            <circle cx={0} cy={0} r={0.4} className={styles.gridMinorDot} />
          </pattern>
          <pattern id="grid-major" width={GRID_MAJOR_STEP_MM} height={GRID_MAJOR_STEP_MM} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_MAJOR_STEP_MM} 0 L 0 0 0 ${GRID_MAJOR_STEP_MM}`} className={styles.gridMajorLine} />
          </pattern>
        </defs>
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-minor)" />
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} fill="url(#grid-major)" />
        {state.points.length >= 2 ? (
          <polyline
            className={clsx(styles.contour, state.intersecting && styles.contourInvalid)}
            points={contourPoints.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {state.status === 'closed' ? (
          <polygon className={styles.fill} points={state.points.map((point) => `${point.x},${point.y}`).join(' ')} />
        ) : null}
        {state.points.map((point, index) => (
          <circle
            key={index}
            data-testid={`shape-editor-vertex-${index}`}
            className={styles.vertex}
            cx={point.x}
            cy={point.y}
            r={4}
          />
        ))}
      </svg>
      <p className={styles.readout}>{readout}</p>
    </div>
  )
}
