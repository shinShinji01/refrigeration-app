import clsx from 'clsx'
import type { Geometry } from '@/shared/lib/geometry'
import { useShapeEditor } from '../model/useShapeEditor'
import { useVertexDrag } from '../model/useVertexDrag'
import { formatReadout } from '../lib/formatReadout'
import { GRID_STEP_MM } from '../lib/snapToGrid'
import PlusIcon from '@/shared/assets/icons/plus.svg?react'
import MinusIcon from '@/shared/assets/icons/minus.svg?react'
import { IconButton } from '@/shared/ui'
import { ShapeEditorVertex } from './ShapeEditorVertex'
import { segmentLabel } from '../lib/segmentLabel'
import { SideLengthLabel } from './SideLengthLabel'
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
  const {
    state,
    dispatch,
    viewBox,
    manualViewBox,
    svgRef,
    canClose,
    vertexRadiusMm,
    vertexHitRadiusMm,
    labelFontSizeMm,
    labelOffsetMm,
    hoverPointMm,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerLeave,
    handleWheel,
    zoomIn,
    zoomOut,
    resetZoom,
  } = useShapeEditor(value, onChange)
  const { getVertexHandlers } = useVertexDrag({ dispatch, svgRef, viewBox })

  const readout = formatReadout(state)
  const contourPoints = state.status === 'closed' ? [...state.points, state.points[0]!] : state.points

  return (
    <div className={styles.root}>
      <svg
        ref={svgRef}
        className={styles.canvas}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        role="img"
        aria-label="Редактор геометрии куска"
        data-testid="shape-editor-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onWheel={handleWheel}
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
        {state.points.map((point, index) => {
          const handlers = getVertexHandlers(index)
          return (
            <ShapeEditorVertex
              key={index}
              point={point}
              index={index}
              radiusMm={vertexRadiusMm}
              hitRadiusMm={vertexHitRadiusMm}
              invalid={state.intersecting}
              draggable={state.status === 'closed'}
              onHandlePointerDown={handlers.onPointerDown}
              onHandlePointerMove={handlers.onPointerMove}
              onHandlePointerUp={handlers.onPointerUp}
            />
          )
        })}
        {contourPoints.slice(0, -1).map((point, index) => {
          const next = contourPoints[index + 1]!
          const label = segmentLabel(point, next, labelOffsetMm)
          if (!label) return null
          return (
            <SideLengthLabel
              key={index}
              label={label}
              fontSizeMm={labelFontSizeMm}
              testId={`shape-editor-side-label-${index}`}
            />
          )
        })}
        {state.status === 'drawing' && state.points.length > 0 && hoverPointMm ? (
          (() => {
            const lastPoint = state.points[state.points.length - 1]!
            const preview = segmentLabel(lastPoint, hoverPointMm, labelOffsetMm)
            return (
              <>
                <line
                  data-testid="shape-editor-preview-line"
                  className={styles.previewLine}
                  x1={lastPoint.x}
                  y1={lastPoint.y}
                  x2={hoverPointMm.x}
                  y2={hoverPointMm.y}
                />
                {preview ? (
                  <SideLengthLabel
                    label={preview}
                    fontSizeMm={labelFontSizeMm}
                    testId="shape-editor-preview-label"
                  />
                ) : null}
              </>
            )
          })()
        ) : null}
      </svg>
      <p className={styles.readout}>{readout}</p>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-undo"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'last-point-undone' })}
        >
          Назад
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-clear"
          disabled={state.points.length === 0}
          onClick={() => dispatch({ type: 'cleared' })}
        >
          Очистить
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-close"
          disabled={!canClose}
          onClick={() => dispatch({ type: 'closed-by-button' })}
        >
          Замкнуть
        </button>
        <IconButton
          icon={PlusIcon}
          label="Приблизить"
          data-testid="shape-editor-zoom-in"
          className={styles.toolbarButton}
          onClick={zoomIn}
        />
        <IconButton
          icon={MinusIcon}
          label="Отдалить"
          data-testid="shape-editor-zoom-out"
          className={styles.toolbarButton}
          onClick={zoomOut}
        />
        <button
          type="button"
          className={styles.toolbarButton}
          data-testid="shape-editor-fit"
          disabled={manualViewBox === null}
          onClick={resetZoom}
        >
          По размеру
        </button>
      </div>
    </div>
  )
}
