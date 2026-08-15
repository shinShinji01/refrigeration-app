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
  // Выбранный элемент (установка/узел/деталь), рядом с которым показываются
  // его дети — null, когда сужения ещё нет (список установок, глобальный поиск).
  parent: ComponentListItem | null
  childItems: ComponentListItem[]
  isLoading: boolean
  // Клик-навигация по карточкам (docs/superpowers/specs/
  // 2026-08-14-units-card-navigation-design.md) включена только вне поиска —
  // в результатах глобального поиска карточки разных типов показаны
  // вперемешку без общего родителя, однозначно провалиться некуда.
  isGlobalSearch: boolean
}

// Ветки поведения списка карточек: установка не выбрана и поиск пуст — все
// установки; установка не выбрана и есть текст — глобальный поиск по трём
// типам; иначе — установка → узел → деталь, каждый следующий уровень сужает
// до себя (parent) и своих детей (childItems).
export const useFilteredComponents = ({
  search,
  includeArchived,
}: UseFilteredComponentsArgs): UseFilteredComponentsResult => {
  const { unitId, assemblyId, partId } = useAppSelector((state) => state.cascadeFilter)
  const isGlobalSearch = !unitId && search.trim().length > 0

  // Поиск по name/drawingNumbers выполняется на клиенте (filterChildren), а не через
  // PocketBase-фильтр: SQLite LIKE регистронезависим только для ASCII, а названия
  // и номера чертежей — кириллица (см. docs/glossary.md).
  const globalUnits = useGetUnitsQuery(isGlobalSearch ? { includeArchived } : skipToken)
  const globalAssemblies = useGetAssembliesQuery(isGlobalSearch ? { includeArchived } : skipToken)
  const globalParts = useGetPartsQuery(isGlobalSearch ? { includeArchived } : skipToken)

  const units = useGetUnitsQuery({ includeArchived })
  const unitAssemblies = useGetAssembliesForUnitQuery(unitId ?? skipToken)
  const assemblyParts = useGetPartsForAssemblyQuery(assemblyId ?? skipToken)

  if (isGlobalSearch) {
    const matchedUnits = filterChildren(globalUnits.data ?? [], search, includeArchived)
    const matchedAssemblies = filterChildren(globalAssemblies.data ?? [], search, includeArchived)
    const matchedParts = filterChildren(globalParts.data ?? [], search, includeArchived)

    return {
      parent: null,
      childItems: [
        ...matchedUnits.map((unit): ComponentListItem => ({ kind: 'unit', unit })),
        ...matchedAssemblies.map((assembly): ComponentListItem => ({ kind: 'assembly', assembly })),
        ...matchedParts.map((part): ComponentListItem => ({ kind: 'part', part })),
      ],
      isLoading: globalUnits.isLoading || globalAssemblies.isLoading || globalParts.isLoading,
      isGlobalSearch: true,
    }
  }

  if (!unitId) {
    return {
      parent: null,
      childItems: units.data?.map((unit): ComponentListItem => ({ kind: 'unit', unit })) ?? [],
      isLoading: units.isLoading,
      isGlobalSearch: false,
    }
  }

  const unit = units.data?.find((candidate) => candidate.id === unitId)
  if (!unit) {
    return { parent: null, childItems: [], isLoading: units.isLoading, isGlobalSearch: false }
  }

  if (!assemblyId) {
    const assemblies = filterChildren(unitAssemblies.data ?? [], search, includeArchived)
    return {
      parent: { kind: 'unit', unit },
      childItems: assemblies.map(
        (assembly): ComponentListItem => ({ kind: 'assembly', assembly, quantity: assembly.quantity }),
      ),
      isLoading: unitAssemblies.isLoading,
      isGlobalSearch: false,
    }
  }

  const assembly = unitAssemblies.data?.find((candidate) => candidate.id === assemblyId)
  if (!assembly) {
    return {
      parent: null,
      childItems: [],
      isLoading: unitAssemblies.isLoading || assemblyParts.isLoading,
      isGlobalSearch: false,
    }
  }

  if (!partId) {
    const parts = filterChildren(assemblyParts.data ?? [], search, includeArchived)
    return {
      parent: { kind: 'assembly', assembly, quantity: assembly.quantity },
      childItems: parts.map((part): ComponentListItem => ({ kind: 'part', part, quantity: part.quantity })),
      isLoading: assemblyParts.isLoading,
      isGlobalSearch: false,
    }
  }

  const part = assemblyParts.data?.find((candidate) => candidate.id === partId)
  return {
    parent: part ? { kind: 'part', part, quantity: part.quantity } : null,
    childItems: [],
    isLoading: assemblyParts.isLoading,
    isGlobalSearch: false,
  }
}
