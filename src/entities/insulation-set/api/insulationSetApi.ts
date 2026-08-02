import { baseApi, pb } from '@/shared/api'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSet } from '../model/types'

export const insulationSetApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Все версии набора для установки, включая архивные — выбор актуальной
    // (pickCurrentSet) и переключение версии в дропдауне делаются на клиенте.
    getInsulationSetsForUnit: builder.query<InsulationSet[], UnitId>({
      query: (unitId) => ({
        collection: 'insulation_sets',
        method: 'getFullList',
        params: {
          filter: pb.filter('unit = {:unitId}', { unitId }),
          sort: '-effectiveFrom',
        },
      }),
      providesTags: (result, _error, unitId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'InsulationSet' as const, id })),
              { type: 'InsulationSet' as const, id: `UNIT_${unitId}` },
            ]
          : [{ type: 'InsulationSet' as const, id: `UNIT_${unitId}` }],
    }),
  }),
})

export const { useGetInsulationSetsForUnitQuery } = insulationSetApi
