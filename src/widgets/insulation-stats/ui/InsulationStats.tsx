import { useState } from 'react'
import { BarChart, DonutChart, EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { useInsulationStats } from '../model/useInsulationStats'
import styles from './InsulationStats.module.scss'

interface InsulationStatsProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
}

// Фиксированные 3 знака в м² — тот же формат, что уже использует подвал
// группы (InsulationGroupItem, summarizeByThickness), а не адаптивный
// shared/lib/utils/formatArea (тот подбирает см²/м² под площадь ОДНОГО
// куска и явно не предназначен для площади группы/набора — см. его
// комментарий).
const formatAreaM2 = (value: number) => `${value.toFixed(3)} м²`

export const InsulationStats = ({ groups, isLoading }: InsulationStatsProps) => {
  const { byGroup, byThickness, totalAreaM2, isLoading: statsLoading } = useInsulationStats(groups)
  const [donutActiveId, setDonutActiveId] = useState<string | null>(null)
  const [barActiveId, setBarActiveId] = useState<string | null>(null)

  if (isLoading || statsLoading) {
    return null
  }

  if (totalAreaM2 === 0) {
    return <EmptyState message="Нет данных для статистики" />
  }

  return (
    <div className={styles.root}>
      <DonutChart
        segments={byGroup.map((entry) => ({ id: entry.id, label: entry.label, value: entry.areaM2 }))}
        activeId={donutActiveId}
        onSegmentActivate={setDonutActiveId}
        valueFormatter={formatAreaM2}
        title="Площадь изоляции по группам"
      />
      <ul className={styles.legend}>
        {byGroup.map((entry, index) => (
          <li key={entry.id}>
            <button
              type="button"
              className={styles.legendRow}
              aria-current={entry.id === donutActiveId}
              onClick={() => setDonutActiveId(entry.id === donutActiveId ? null : entry.id)}
            >
              <span className={styles.legendIndex}>{index + 1}</span>
              <span className={styles.legendName}>{entry.label}</span>
              <span className={styles.legendValue}>{formatAreaM2(entry.areaM2)}</span>
              <span className={styles.legendPercent}>{Math.round((entry.areaM2 / totalAreaM2) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
      <BarChart
        bars={byThickness.map((entry) => ({
          id: String(entry.thicknessMm),
          label: `${entry.thicknessMm} мм`,
          value: entry.areaM2,
        }))}
        activeId={barActiveId}
        onBarActivate={setBarActiveId}
        valueFormatter={formatAreaM2}
        title="Площадь изоляции по толщине"
      />
    </div>
  )
}
