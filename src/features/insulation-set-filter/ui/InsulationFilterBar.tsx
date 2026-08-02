import { format } from 'date-fns'
import { Combobox } from '@/shared/ui'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import type { InsulationSet } from '@/entities/insulation-set'
import { useInsulationSetFilter } from '../model/useInsulationSetFilter'
import styles from './InsulationFilterBar.module.scss'

const getUnitLabel = (unit: RefrigerationUnit): string => unit.name
const getUnitKey = (unit: RefrigerationUnit): string => unit.id

const getSetLabel = (set: InsulationSet): string => {
  const date = format(new Date(set.effectiveFrom), 'dd.MM.yyyy')
  return set.name ? `${set.name} (${date})` : date
}
const getSetKey = (set: InsulationSet): string => set.id

// Установка → версия набора: версия недоступна, пока не выбрана установка,
// и авто-выбирается самой актуальной при смене установки (docs/spec.md).
export const InsulationFilterBar = () => {
  const { unitId, selectUnit, sets, selectedSet, selectSet } = useInsulationSetFilter()
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null

  return (
    <div className={styles.root}>
      <Combobox<RefrigerationUnit>
        items={units}
        value={selectedUnit}
        onChange={(unit) => selectUnit(unit?.id ?? null)}
        getItemLabel={getUnitLabel}
        getItemKey={getUnitKey}
        placeholder="Установка"
        aria-label="Выбор холодильной установки"
      />
      <Combobox<InsulationSet>
        items={sets}
        value={selectedSet}
        onChange={(set) => selectSet(set?.id ?? null)}
        getItemLabel={getSetLabel}
        getItemKey={getSetKey}
        placeholder="Версия набора"
        disabled={!unitId}
        aria-label="Выбор версии набора изоляции"
      />
    </div>
  )
}
