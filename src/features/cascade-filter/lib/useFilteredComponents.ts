import { skipToken } from '@reduxjs/toolkit/query/react'
import { useAppSelector } from '@/app/store'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import { useGetAssembliesQuery, useGetAssembliesForUnitQuery } from '@/entities/assembly'
import type { Assembly } from '@/entities/assembly'
import { useGetPartsQuery, useGetPartsForAssemblyQuery } from '@/entities/part'
import type { Part } from '@/entities/part'
import { filterChildren } from './filterChildren'

export type ComponentListItem =
  | { kind: 'unit'; unit: RefrigerationUnit }
  | { kind: 'assembly'; assembly: Assembly; quantity?: number }
  | { kind: 'part'; part: Part; quantity?: number }

export interface UseFilteredComponentsArgs {
  search: string
  includeArchived: boolean
}

interface UseFilteredComponentsResult {
  items: ComponentListItem[]
  isLoading: boolean
  // Ничего не выбрано и поиск пуст — по ТЗ список ничего не показывает,
  // это не то же самое, что «есть фильтр, но результатов нет».
  isIdle: boolean
}

// Ветки поведения списка карточек — см. "Контекст" в плане прохода:
// ничего не выбрано (пусто/глобальный поиск) → установка → узел → деталь,
// каждый следующий уровень сужает список до себя + своих детей.
export const useFilteredComponents = ({
  search,
  includeArchived,
}: UseFilteredComponentsArgs): UseFilteredComponentsResult => {
  const { unitId, assemblyId, partId } = useAppSelector((state) => state.cascadeFilter)
  const isGlobalSearch = !unitId && search.trim().length > 0

  const globalUnits = useGetUnitsQuery(isGlobalSearch ? { search, includeArchived } : skipToken)
  const globalAssemblies = useGetAssembliesQuery(isGlobalSearch ? { search, includeArchived } : skipToken)
  const globalParts = useGetPartsQuery(isGlobalSearch ? { search, includeArchived } : skipToken)

  const units = useGetUnitsQuery(unitId ? { includeArchived } : skipToken)
  const unitAssemblies = useGetAssembliesForUnitQuery(unitId ?? skipToken)
  const assemblyParts = useGetPartsForAssemblyQuery(assemblyId ?? skipToken)

  if (isGlobalSearch) {
    return {
      items: [
        ...(globalUnits.data ?? []).map((unit): ComponentListItem => ({ kind: 'unit', unit })),
        ...(globalAssemblies.data ?? []).map((assembly): ComponentListItem => ({ kind: 'assembly', assembly })),
        ...(globalParts.data ?? []).map((part): ComponentListItem => ({ kind: 'part', part })),
      ],
      isLoading: globalUnits.isLoading || globalAssemblies.isLoading || globalParts.isLoading,
      isIdle: false,
    }
  }

  if (!unitId) {
    return { items: [], isLoading: false, isIdle: true }
  }

  const unit = units.data?.find((candidate) => candidate.id === unitId)
  if (!unit) {
    return { items: [], isLoading: units.isLoading, isIdle: false }
  }

  if (!assemblyId) {
    const assemblies = filterChildren(unitAssemblies.data ?? [], search, includeArchived)
    return {
      items: [
        { kind: 'unit', unit },
        ...assemblies.map(
          (assembly): ComponentListItem => ({ kind: 'assembly', assembly, quantity: assembly.quantity }),
        ),
      ],
      isLoading: unitAssemblies.isLoading,
      isIdle: false,
    }
  }

  const assembly = unitAssemblies.data?.find((candidate) => candidate.id === assemblyId)
  if (!assembly) {
    return { items: [], isLoading: unitAssemblies.isLoading || assemblyParts.isLoading, isIdle: false }
  }

  if (!partId) {
    const parts = filterChildren(assemblyParts.data ?? [], search, includeArchived)
    return {
      items: [
        { kind: 'assembly', assembly, quantity: assembly.quantity },
        ...parts.map((part): ComponentListItem => ({ kind: 'part', part, quantity: part.quantity })),
      ],
      isLoading: assemblyParts.isLoading,
      isIdle: false,
    }
  }

  const part = assemblyParts.data?.find((candidate) => candidate.id === partId)
  return {
    items: part ? [{ kind: 'part', part, quantity: part.quantity }] : [],
    isLoading: assemblyParts.isLoading,
    isIdle: false,
  }
}
