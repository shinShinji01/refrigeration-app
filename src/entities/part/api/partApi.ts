import { baseApi, pb } from '@/shared/api'
import { buildNameFilter } from '@/shared/lib/utils'
import type { AssemblyId } from '@/entities/assembly'
import type { Part, PartId, PartWithQuantity } from '../model/types'

export interface GetPartsArgs {
  search?: string
  includeArchived?: boolean
}

export type UpdatePartArgs = { id: PartId } & Partial<
  Pick<Part, 'name' | 'drawingNumbers' | 'commissionedAt' | 'isArchived'>
>

// assembly_parts: assembly (rel), part (rel), quantity — см. docs/data-model.md.
interface AssemblyPartRecord {
  id: string
  assembly: string
  part: string
  quantity: number
  expand?: { part: Part }
}

// part_parts: parent (rel → parts), child (rel → parts), quantity, order.
interface PartPartRecord {
  id: string
  parent: string
  child: string
  quantity: number
  order: number
  expand?: { child: Part }
}

const withDrawingNumbers = (part: Part): Part => ({
  ...part,
  drawingNumbers: part.drawingNumbers ?? [],
})

export const partApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getParts: builder.query<Part[], GetPartsArgs | void>({
      query: (args) => ({
        collection: 'parts',
        method: 'getFullList',
        params: {
          filter: buildNameFilter({
            search: args?.search ?? '',
            includeArchived: args?.includeArchived ?? false,
          }),
          sort: 'name',
        },
      }),
      transformResponse: (parts: Part[]): Part[] => parts.map(withDrawingNumbers),
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Part' as const, id })), { type: 'Part' as const, id: 'LIST' }]
          : [{ type: 'Part' as const, id: 'LIST' }],
    }),

    // Детали конкретного узла, с количеством на узел (docs/spec.md →
    // "Для сборочных узлов: список деталей с их количеством на узел").
    getPartsForAssembly: builder.query<PartWithQuantity[], AssemblyId>({
      query: (assemblyId) => ({
        collection: 'assembly_parts',
        method: 'getFullList',
        params: {
          filter: pb.filter('assembly = {:assemblyId}', { assemblyId }),
          expand: 'part',
        },
      }),
      transformResponse: (links: AssemblyPartRecord[]): PartWithQuantity[] =>
        links
          .filter((link) => link.expand?.part)
          .map((link) => ({
            ...withDrawingNumbers(link.expand!.part),
            quantity: link.quantity,
          }))
          .sort((a, b) => a.name.localeCompare(b.name, 'ru')),
      providesTags: (result, _error, assemblyId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Part' as const, id })),
              { type: 'Part' as const, id: `ASSEMBLY_${assemblyId}` },
            ]
          : [{ type: 'Part' as const, id: `ASSEMBLY_${assemblyId}` }],
    }),

    // Дочерние детали рекурсивного состава (docs/decisions.md №9) — только
    // для текстовой сводки внутри карточки детали-родителя, не для отдельных карточек.
    getPartChildren: builder.query<PartWithQuantity[], PartId>({
      query: (partId) => ({
        collection: 'part_parts',
        method: 'getFullList',
        params: {
          filter: pb.filter('parent = {:partId}', { partId }),
          expand: 'child',
          sort: 'order',
        },
      }),
      transformResponse: (links: PartPartRecord[]): PartWithQuantity[] =>
        links
          .filter((link) => link.expand?.child)
          .map((link) => ({
            ...withDrawingNumbers(link.expand!.child),
            quantity: link.quantity,
          })),
      providesTags: (result, _error, partId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Part' as const, id })),
              { type: 'Part' as const, id: `PARENT_${partId}` },
            ]
          : [{ type: 'Part' as const, id: `PARENT_${partId}` }],
    }),

    updatePart: builder.mutation<Part, UpdatePartArgs>({
      query: ({ id, ...body }) => ({ collection: 'parts', method: 'update', id, body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Part', id },
        { type: 'Part', id: 'LIST' },
      ],
    }),

    deletePart: builder.mutation<null, PartId>({
      query: (id) => ({ collection: 'parts', method: 'delete', id }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Part', id },
        { type: 'Part', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetPartsQuery,
  useGetPartsForAssemblyQuery,
  useGetPartChildrenQuery,
  useLazyGetPartsForAssemblyQuery,
  useLazyGetPartChildrenQuery,
  useUpdatePartMutation,
  useDeletePartMutation,
} = partApi
