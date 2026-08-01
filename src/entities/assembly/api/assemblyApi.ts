import { baseApi, pb } from '@/shared/api'
import { buildNameFilter } from '@/shared/lib/utils'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { Assembly, AssemblyWithQuantity } from '../model/types'

export interface GetAssembliesArgs {
  search?: string
  includeArchived?: boolean
}

// unit_assemblies: unit (rel), assembly (rel), quantity — см. docs/data-model.md.
interface UnitAssemblyRecord {
  id: string
  unit: string
  assembly: string
  quantity: number
  expand?: { assembly: Assembly }
}

const withDrawingNumbers = (assembly: Assembly): Assembly => ({
  ...assembly,
  drawingNumbers: assembly.drawingNumbers ?? [],
})

export const assemblyApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAssemblies: builder.query<Assembly[], GetAssembliesArgs | void>({
      query: (args) => ({
        collection: 'assemblies',
        method: 'getFullList',
        params: {
          filter: buildNameFilter({
            search: args?.search ?? '',
            includeArchived: args?.includeArchived ?? false,
          }),
          sort: 'name',
        },
      }),
      transformResponse: (assemblies: Assembly[]): Assembly[] => assemblies.map(withDrawingNumbers),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Assembly' as const, id })),
              { type: 'Assembly' as const, id: 'LIST' },
            ]
          : [{ type: 'Assembly' as const, id: 'LIST' }],
    }),

    // Узлы конкретной установки, с количеством на установку (docs/spec.md →
    // "Для холодильных установок: список сборочных узлов с их количеством").
    getAssembliesForUnit: builder.query<AssemblyWithQuantity[], UnitId>({
      query: (unitId) => ({
        collection: 'unit_assemblies',
        method: 'getFullList',
        params: {
          filter: pb.filter('unit = {:unitId}', { unitId }),
          expand: 'assembly',
        },
      }),
      // Сортировка по имени — на клиенте: PocketBase не сортирует по полям
      // развёрнутой relation-записи, только по собственным полям коллекции.
      transformResponse: (links: UnitAssemblyRecord[]): AssemblyWithQuantity[] =>
        links
          .filter((link) => link.expand?.assembly)
          .map((link) => ({
            ...withDrawingNumbers(link.expand!.assembly),
            quantity: link.quantity,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      providesTags: (result, _error, unitId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Assembly' as const, id })),
              { type: 'Assembly' as const, id: `UNIT_${unitId}` },
            ]
          : [{ type: 'Assembly' as const, id: `UNIT_${unitId}` }],
    }),
  }),
})

export const { useGetAssembliesQuery, useGetAssembliesForUnitQuery } = assemblyApi
