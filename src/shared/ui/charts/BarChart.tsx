import clsx from 'clsx'
import styles from './BarChart.module.scss'

export interface Bar {
  id: string
  label: string
  value: number
}

interface BarChartProps {
  bars: Bar[]
  activeId: string | null
  onBarActivate: (id: string | null) => void
  valueFormatter?: (value: number) => string
  title: string
}

const HEIGHT = 160
const BAR_WIDTH = 32
const BAR_GAP = 16
const AXIS_TICKS = 4

export const BarChart = ({ bars, activeId, onBarActivate, valueFormatter = String, title }: BarChartProps) => {
  const maxValue = Math.max(...bars.map((bar) => bar.value), 0)
  const width = bars.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP

  const toggle = (id: string) => {
    onBarActivate(id === activeId ? null : id)
  }

  return (
    <div className={styles.root}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={title}
      >
        {Array.from({ length: AXIS_TICKS + 1 }, (_, tick) => {
          const y = HEIGHT - (tick / AXIS_TICKS) * HEIGHT
          return <line key={tick} className={styles.axisLine} x1={0} x2={width} y1={y} y2={y} />
        })}
        {bars.map((bar, index) => {
          const barHeight = maxValue > 0 ? (bar.value / maxValue) * HEIGHT : 0
          const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP)
          return (
            <g key={bar.id}>
              <rect
                className={clsx(styles.bar, bar.id === activeId && styles.barActive)}
                x={x}
                y={HEIGHT - barHeight}
                width={BAR_WIDTH}
                height={barHeight}
                tabIndex={0}
                role="button"
                aria-label={`${bar.label}: ${valueFormatter(bar.value)}`}
                aria-pressed={bar.id === activeId}
                onClick={() => toggle(bar.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  toggle(bar.id)
                }}
              />
              <text className={styles.value} x={x + BAR_WIDTH / 2} y={Math.max(HEIGHT - barHeight - 6, 10)} textAnchor="middle">
                {valueFormatter(bar.value)}
              </text>
            </g>
          )
        })}
      </svg>
      <div className={styles.labels} style={{ gridTemplateColumns: `repeat(${bars.length}, 1fr)` }}>
        {bars.map((bar) => (
          <span key={bar.id} className={styles.label}>
            {bar.label}
          </span>
        ))}
      </div>
    </div>
  )
}
