import { useState } from 'react'
import { useCardSelection } from '@/features/card-selection'
import type { ComponentListItem } from '@/features/cascade-filter'
import { useUpdateUnitMutation, useDeleteUnitMutation } from '@/entities/refrigeration-unit'
import type { UnitId } from '@/entities/refrigeration-unit'
import {
  useUpdateAssemblyMutation,
  useDeleteAssemblyMutation,
  useLazyGetAssembliesForUnitQuery,
} from '@/entities/assembly'
import type { AssemblyId } from '@/entities/assembly'
import {
  useUpdatePartMutation,
  useDeletePartMutation,
  useLazyGetPartsForAssemblyQuery,
  useLazyGetPartChildrenQuery,
} from '@/entities/part'
import type { PartId } from '@/entities/part'
import { collectDeletionDescendants } from './collectDeletionDescendants'

// Мутации разбиты по типу (unit/assembly/part), потому что выделение — это
// всегда микс из трёх сущностей (глобальный поиск, сплит-раскладка родитель+дети).
export const useBulkActions = (selectedItems: ComponentListItem[]) => {
  const { clearSelection } = useCardSelection()
  const [isBusy, setIsBusy] = useState(false)

  const [updateUnit] = useUpdateUnitMutation()
  const [deleteUnit] = useDeleteUnitMutation()
  const [updateAssembly] = useUpdateAssemblyMutation()
  const [deleteAssembly] = useDeleteAssemblyMutation()
  const [updatePart] = useUpdatePartMutation()
  const [deletePart] = useDeletePartMutation()
  const [triggerAssembliesForUnit] = useLazyGetAssembliesForUnitQuery()
  const [triggerPartsForAssembly] = useLazyGetPartsForAssemblyQuery()
  const [triggerPartChildren] = useLazyGetPartChildrenQuery()

  const setArchivedForSelected = async (isArchived: boolean) => {
    if (selectedItems.length === 0) return
    setIsBusy(true)
    try {
      await Promise.all(
        selectedItems.map((item) => {
          if (item.kind === 'unit') return updateUnit({ id: item.unit.id, isArchived }).unwrap()
          if (item.kind === 'assembly') return updateAssembly({ id: item.assembly.id, isArchived }).unwrap()
          return updatePart({ id: item.part.id, isArchived }).unwrap()
        }),
      )
      clearSelection()
    } finally {
      setIsBusy(false)
    }
  }

  const deleteSelected = async () => {
    if (selectedItems.length === 0) return
    if (!window.confirm(`Удалить выбранные элементы (${selectedItems.length})?`)) return

    setIsBusy(true)
    try {
      const { assemblyIds: descendantAssemblyIds, partIds: descendantPartIds } = await collectDeletionDescendants(
        selectedItems,
        {
          fetchAssembliesForUnit: (unitId) => triggerAssembliesForUnit(unitId).unwrap(),
          fetchPartsForAssembly: (assemblyId) => triggerPartsForAssembly(assemblyId).unwrap(),
          fetchPartChildren: (partId) => triggerPartChildren(partId).unwrap(),
        },
      )

      let cascade = false
      if (descendantAssemblyIds.length > 0 || descendantPartIds.length > 0) {
        cascade = window.confirm(
          `У выбранного есть дочерний состав: ${descendantAssemblyIds.length} узлов и ` +
            `${descendantPartIds.length} деталей. Удалить их вместе с выбранным? Если среди них есть ` +
            `узлы или детали, использующиеся в другом месте состава — удалятся и там.\n\n` +
            `Отмена — удалятся только выбранные элементы, их состав останется отдельными записями.`,
        )
      }

      const unitIds: UnitId[] = []
      const assemblyIds = new Set<AssemblyId>()
      const partIds = new Set<PartId>()
      for (const item of selectedItems) {
        if (item.kind === 'unit') unitIds.push(item.unit.id)
        else if (item.kind === 'assembly') assemblyIds.add(item.assembly.id)
        else partIds.add(item.part.id)
      }

      if (cascade) {
        descendantAssemblyIds.forEach((id) => assemblyIds.add(id))
        descendantPartIds.forEach((id) => partIds.add(id))
      }

      await Promise.all([
        ...unitIds.map((id) => deleteUnit(id).unwrap()),
        ...[...assemblyIds].map((id) => deleteAssembly(id).unwrap()),
        ...[...partIds].map((id) => deletePart(id).unwrap()),
      ])
      clearSelection()
    } finally {
      setIsBusy(false)
    }
  }

  return {
    isBusy,
    archiveSelected: () => setArchivedForSelected(true),
    unarchiveSelected: () => setArchivedForSelected(false),
    deleteSelected,
  }
}
