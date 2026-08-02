import { baseApi } from '@/shared/api'
import { buildUnitsFilter } from '../lib/buildUnitsFilter'
import type { RefrigerationUnit, UnitId } from '../model/types'

export interface GetUnitsArgs {
  search?: string
  includeArchived?: boolean
}

// Архивация (bulk-панель) шлёт только isArchived, модалка редактирования —
// остальные поля; оба через одну мутацию, PocketBase принимает частичный body.
export type UpdateUnitArgs = { id: UnitId } & Partial<
  Pick<RefrigerationUnit, 'name' | 'drawingNumbers' | 'commissionedAt' | 'isArchived'>
>

export const unitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUnits: builder.query<RefrigerationUnit[], GetUnitsArgs | void>({
      query: (args) => ({
        collection: 'units',
        method: 'getFullList',
        params: {
          filter: buildUnitsFilter({
            search: args?.search ?? '',
            includeArchived: args?.includeArchived ?? false,
          }),
          sort: 'name',
        },
      }),
      // PocketBase хранит незаполненное json-поле как null, а не [] — приводим
      // на границе api, чтобы дальше по приложению drawingNumbers всегда был массивом.
      transformResponse: (units: RefrigerationUnit[]): RefrigerationUnit[] =>
        units.map((unit) => ({
          ...unit,
          drawingNumbers: unit.drawingNumbers ?? [],
        })),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Unit' as const, id })),
              { type: 'Unit' as const, id: 'LIST' },
            ]
          : [{ type: 'Unit' as const, id: 'LIST' }],
    }),

    updateUnit: builder.mutation<RefrigerationUnit, UpdateUnitArgs>({
      query: ({ id, ...body }) => ({ collection: 'units', method: 'update', id, body }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Unit', id },
        { type: 'Unit', id: 'LIST' },
      ],
    }),

    deleteUnit: builder.mutation<null, UnitId>({
      query: (id) => ({ collection: 'units', method: 'delete', id }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Unit', id },
        { type: 'Unit', id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetUnitsQuery, useUpdateUnitMutation, useDeleteUnitMutation } = unitApi
