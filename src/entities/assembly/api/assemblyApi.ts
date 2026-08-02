import { baseApi, pb } from '@/shared/api'
import { buildNameFilter } from '@/shared/lib/utils'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { Assembly, AssemblyId, AssemblyWithQuantity } from '../model/types'

export interface GetAssembliesArgs {
  search?: string
  includeArchived?: boolean
}

export type UpdateAssemblyArgs = { id: AssemblyId } & Partial<
  Pick<Assembly, 'name' | 'drawingNumbers' | 'commissionedAt' | 'introducedAtUnitNo' | 'isArchived'>
>

export interface AddAssemblyToUnitArgs {
  unitId: UnitId
  assemblyId: AssemblyId
  quantity: number
}

// unitId нужен только для инвалидации тега UNIT_${unitId} — сама join-запись
// адресуется по linkId.
export interface UpdateUnitAssemblyQuantityArgs {
  unitId: UnitId
  linkId: string
  quantity: number
}

export interface RemoveAssemblyFromUnitArgs {
  unitId: UnitId
  linkId: string
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
            linkId: link.id,
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

    updateAssembly: builder.mutation<Assembly, UpdateAssemblyArgs>({
      query: ({ id, ...body }) => ({ collection: 'assemblies', method: 'update', id, body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Assembly', id },
        { type: 'Assembly', id: 'LIST' },
      ],
    }),

    deleteAssembly: builder.mutation<null, AssemblyId>({
      query: (id) => ({ collection: 'assemblies', method: 'delete', id }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Assembly', id },
        { type: 'Assembly', id: 'LIST' },
      ],
    }),

    // Состав установки (children-picker в модалке редактирования) — join-записи
    // unit_assemblies, отдельно от самой сущности узла.
    addAssemblyToUnit: builder.mutation<null, AddAssemblyToUnitArgs>({
      query: ({ unitId, assemblyId, quantity }) => ({
        collection: 'unit_assemblies',
        method: 'create',
        body: { unit: unitId, assembly: assemblyId, quantity },
      }),
      invalidatesTags: (_result, _error, { unitId }) => [{ type: 'Assembly', id: `UNIT_${unitId}` }],
    }),

    updateUnitAssemblyQuantity: builder.mutation<null, UpdateUnitAssemblyQuantityArgs>({
      query: ({ linkId, quantity }) => ({
        collection: 'unit_assemblies',
        method: 'update',
        id: linkId,
        body: { quantity },
      }),
      invalidatesTags: (_result, _error, { unitId }) => [{ type: 'Assembly', id: `UNIT_${unitId}` }],
    }),

    removeAssemblyFromUnit: builder.mutation<null, RemoveAssemblyFromUnitArgs>({
      query: ({ linkId }) => ({ collection: 'unit_assemblies', method: 'delete', id: linkId }),
      invalidatesTags: (_result, _error, { unitId }) => [{ type: 'Assembly', id: `UNIT_${unitId}` }],
    }),
  }),
})

export const {
  useGetAssembliesQuery,
  useGetAssembliesForUnitQuery,
  useLazyGetAssembliesForUnitQuery,
  useUpdateAssemblyMutation,
  useDeleteAssemblyMutation,
  useAddAssemblyToUnitMutation,
  useUpdateUnitAssemblyQuantityMutation,
  useRemoveAssemblyFromUnitMutation,
} = assemblyApi
