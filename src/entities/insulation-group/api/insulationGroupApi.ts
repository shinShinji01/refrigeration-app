import { baseApi, pb } from '@/shared/api'
import type { InsulationSetId } from '@/entities/insulation-set'
import type { InsulationGroup, InsulationGroupWithQuantity } from '../model/types'

// set_groups: set (rel), group (rel), quantity, order — см. docs/data-model.md.
interface SetGroupRecord {
  id: string
  set: string
  group: string
  quantity: number
  order: number
  expand?: { group: InsulationGroup }
}

export const insulationGroupApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Группы конкретного набора изоляции, в порядке показа (docs/spec.md →
    // "Список изоляции и отслеживание прогресса нарезания").
    getGroupsForSet: builder.query<InsulationGroupWithQuantity[], InsulationSetId>({
      query: (setId) => ({
        collection: 'set_groups',
        method: 'getFullList',
        params: {
          filter: pb.filter('set = {:setId}', { setId }),
          sort: 'order',
          expand: 'group',
        },
      }),
      transformResponse: (links: SetGroupRecord[]): InsulationGroupWithQuantity[] =>
        links
          .filter((link) => link.expand?.group)
          .map((link) => ({
            ...link.expand!.group,
            quantity: link.quantity,
            order: link.order,
            linkId: link.id,
          })),
      providesTags: (result, _error, setId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'InsulationGroup' as const, id })),
              { type: 'InsulationGroup' as const, id: `SET_${setId}` },
            ]
          : [{ type: 'InsulationGroup' as const, id: `SET_${setId}` }],
    }),
  }),
})

export const { useGetGroupsForSetQuery } = insulationGroupApi
