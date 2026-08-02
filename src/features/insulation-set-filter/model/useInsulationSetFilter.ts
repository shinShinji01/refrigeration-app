import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppDispatch, useAppSelector } from '@/app/store'
import type { UnitId } from '@/entities/refrigeration-unit'
import { useGetInsulationSetsForUnitQuery, pickCurrentSet } from '@/entities/insulation-set'
import type { InsulationSet, InsulationSetId } from '@/entities/insulation-set'
import { unitSelected, setSelected } from './insulationFilterSlice'

// selectedSetId — явный выбор пользователя (setId) или, пока его нет,
// авто-выбор самой актуальной версии (pickCurrentSet). Оборачивать в effect
// не нужно: это просто производное значение, не отдельный кусок стейта.
export const useInsulationSetFilter = () => {
  const dispatch = useAppDispatch()
  const { unitId, setId } = useAppSelector((state) => state.insulationFilter)

  const { data: sets = [], isLoading } = useGetInsulationSetsForUnitQuery(unitId ?? skipToken)
  const currentSet = pickCurrentSet(sets)
  const selectedSetId = setId ?? currentSet?.id ?? null
  const selectedSet: InsulationSet | null = sets.find((set) => set.id === selectedSetId) ?? null

  return {
    unitId,
    selectUnit: (id: UnitId | null) => dispatch(unitSelected(id)),
    sets,
    selectedSet,
    selectedSetId,
    selectSet: (id: InsulationSetId | null) => dispatch(setSelected(id)),
    isLoading,
  }
}
