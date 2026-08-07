import { useId } from 'react'
import clsx from 'clsx'
import { computeDonutGeometry } from './lib/donutGeometry'
import styles from './DonutChart.module.scss'

export interface DonutSegment {
  id: string
  label: string
  value: number
}

interface DonutChartProps {
  segments: DonutSegment[]
  activeId: string | null
  onSegmentActivate: (id: string | null) => void
  valueFormatter?: (value: number) => string
}

const SIZE = 200
const STROKE_WIDTH = 28
const RADIUS = (SIZE - STROKE_WIDTH) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export const DonutChart = ({
  segments,
  activeId,
  onSegmentActivate,
  valueFormatter = String,
}: DonutChartProps) => {
  const titleId = useId()
  const geometry = computeDonutGeometry(segments, CIRCUMFERENCE)

  const toggle = (id: string) => {
    onSegmentActivate(id === activeId ? null : id)
  }

  return (
    <svg className={styles.root} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-labelledby={titleId}>
      <title id={titleId}>Диаграмма распределения площади</title>
      <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
        {segments.map((segment, index) => (
          <circle
            key={segment.id}
            className={clsx(styles.segment, segment.id === activeId && styles.segmentActive)}
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={geometry[index].dasharray}
            strokeDashoffset={geometry[index].dashoffset}
            tabIndex={0}
            role="button"
            aria-label={`${segment.label}: ${valueFormatter(segment.value)}`}
            aria-pressed={segment.id === activeId}
            onClick={() => toggle(segment.id)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              toggle(segment.id)
            }}
          />
        ))}
      </g>
    </svg>
  )
}
