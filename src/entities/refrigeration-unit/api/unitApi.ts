import { baseApi } from '@/shared/api'
import { buildUnitsFilter } from '../lib/buildUnitsFilter'
import type { RefrigerationUnit } from '../model/types'

export interface GetUnitsArgs {
  search?: string
  includeArchived?: boolean
}

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
  }),
})

export const { useGetUnitsQuery } = unitApi
