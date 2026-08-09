import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppSelector } from '@/app/store'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { UnitId } from '@/entities/refrigeration-unit'
import { useGetInsulationSetsForUnitQuery, pickCurrentSet } from '@/entities/insulation-set'
import type { InsulationSet, InsulationSetId } from '@/entities/insulation-set'
import { unitSelected, setSelected, unitNoSelected } from './insulationFilterSlice'

// selectedSetId/selectedUnitNo — явный выбор пользователя или, пока его нет,
// авто-выбор (самая актуальная версия / lastCompletedUnitNoInsulation + 1).
// Оборачивать в effect не нужно: это просто производные значения.
export const useInsulationSetFilter = () => {
  const dispatch = useAppDispatch()
  const { unitId, setId, unitNo } = useAppSelector((state) => state.insulationFilter)

  // Тот же кеш, что уже прогрет InsulationFilterBar (дропдаун установки) —
  // лишнего запроса нет, RTK Query дедуплицирует по эндпоинту+аргументам.
  const { data: units = [] } = useGetUnitsQuery({ includeArchived: false })
  const unit = units.find((candidate) => candidate.id === unitId) ?? null

  const { data: sets = [], isLoading } = useGetInsulationSetsForUnitQuery(unitId ?? skipToken)
  const currentSet = pickCurrentSet(sets)
  const selectedSetId = setId ?? currentSet?.id ?? null
  const selectedSet: InsulationSet | null = sets.find((set) => set.id === selectedSetId) ?? null

  const defaultUnitNo = unit ? (unit.lastCompletedUnitNoInsulation ?? 0) + 1 : null
  const selectedUnitNo = unitNo ?? defaultUnitNo

  return {
    unitId,
    selectUnit: (id: UnitId | null) => dispatch(unitSelected(id)),
    sets,
    selectedSet,
    selectedSetId,
    selectSet: (id: InsulationSetId | null) => dispatch(setSelected(id)),
    selectedUnitNo,
    selectUnitNo: (n: number | null) => dispatch(unitNoSelected(n)),
    isLoading,
  }
}
