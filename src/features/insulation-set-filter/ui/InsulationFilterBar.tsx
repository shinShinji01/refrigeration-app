import { useState } from 'react'
import { skipToken } from '@reduxjs/toolkit/query/react'
import { format } from 'date-fns'
import { Combobox } from '@/shared/ui'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import type { InsulationSet } from '@/entities/insulation-set'
import { useGetInProgressCuttingSessionsQuery } from '@/entities/cutting-session'
import { useInsulationSetFilter } from '../model/useInsulationSetFilter'
import { useUnitNoCommit } from '../model/useUnitNoCommit'
import styles from './InsulationFilterBar.module.scss'

const getUnitLabel = (unit: RefrigerationUnit): string => unit.name
const getUnitKey = (unit: RefrigerationUnit): string => unit.id

const getSetLabel = (set: InsulationSet): string => {
  const date = format(new Date(set.effectiveFrom), 'dd.MM.yyyy')
  return set.name ? `${set.name} (${date})` : date
}
const getSetKey = (set: InsulationSet): string => set.id

// Установка → версия набора → номер установки: версия недоступна, пока не
// выбрана установка, номер — пока не выбраны установка и версия
// (docs/spec.md).
export const InsulationFilterBar = () => {
  const { unitId, selectUnit, sets, selectedSet, selectSet, selectedSetId, selectedUnitNo } =
    useInsulationSetFilter()
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })
  const { commit, commitError } = useUnitNoCommit({ unitId, setId: selectedSetId })
  const { data: inProgress = [] } = useGetInProgressCuttingSessionsQuery(
    unitId && selectedSetId ? { unitId, setId: selectedSetId } : skipToken,
  )

  // Локальный draft — коммитим по Enter/blur, не на каждый символ. Синк с
  // selectedUnitNo обрабатывает и внешние смены (чипы, реоткрытие, "Сохранить"
  // переключает на N+1), и первичный автовыбор. setState во время рендера
  // (а не в эффекте) — рекомендованный React-паттерн для подстройки состояния
  // под изменившееся значение извне, без лишнего цикла рендера
  // (react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState(selectedUnitNo !== null ? String(selectedUnitNo) : '')
  const [syncedUnitNo, setSyncedUnitNo] = useState(selectedUnitNo)
  if (selectedUnitNo !== syncedUnitNo) {
    setSyncedUnitNo(selectedUnitNo)
    setDraft(selectedUnitNo !== null ? String(selectedUnitNo) : '')
  }

  const selectedUnit = units.find((unit) => unit.id === unitId) ?? null

  const commitDraft = () => {
    const parsed = Number(draft)
    if (Number.isInteger(parsed) && parsed >= 1) {
      commit(parsed)
    } else {
      setDraft(selectedUnitNo !== null ? String(selectedUnitNo) : '')
    }
  }

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
      {unitId && selectedSetId ? (
        <div className={styles.unitNo}>
          <input
            className={styles.unitNoInput}
            type="number"
            min={1}
            step={1}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitDraft()
              }
            }}
            placeholder="№ установки"
            aria-label="Номер установки"
          />
          {inProgress.length > 0 ? (
            <div className={styles.chips} role="group" aria-label="Установки в работе">
              {inProgress.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  className={styles.chip}
                  aria-pressed={session.unitNo === selectedUnitNo}
                  onClick={() => commit(session.unitNo)}
                >
                  {session.unitNo}
                </button>
              ))}
            </div>
          ) : null}
          {commitError ? <p className={styles.error}>{commitError}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
