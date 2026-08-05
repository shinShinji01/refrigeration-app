import { baseApi, pb } from '@/shared/api'
import type { InsulationGroupId } from '@/entities/insulation-group'
import type { InsulationPiece, InsulationPieceWithQuantity } from '../model/types'

// group_pieces: group (rel), piece (rel), quantity, order — см. docs/data-model.md.
interface GroupPieceRecord {
  id: string
  group: string
  piece: string
  quantity: number
  order: number
  expand?: { piece: InsulationPiece }
}

const withDrawingNumbers = (piece: InsulationPiece): InsulationPiece => ({
  ...piece,
  drawingNumbers: piece.drawingNumbers ?? [],
})

const toPiecesWithQuantity = (links: GroupPieceRecord[]): InsulationPieceWithQuantity[] =>
  links
    .filter((link) => link.expand?.piece)
    .map((link) => ({
      ...withDrawingNumbers(link.expand!.piece),
      quantity: link.quantity,
      order: link.order,
      linkId: link.id,
    }))

export const insulationPieceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Куски конкретной группы, в порядке показа (docs/spec.md → "Список
    // изоляции и отслеживание прогресса нарезания").
    getPiecesForGroup: builder.query<InsulationPieceWithQuantity[], InsulationGroupId>({
      query: (groupId) => ({
        collection: 'group_pieces',
        method: 'getFullList',
        params: {
          filter: pb.filter('group = {:groupId}', { groupId }),
          sort: 'order',
          expand: 'piece',
        },
      }),
      transformResponse: toPiecesWithQuantity,
      providesTags: (result, _error, groupId) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'InsulationPiece' as const, id })),
              { type: 'InsulationPiece' as const, id: `GROUP_${groupId}` },
            ]
          : [{ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` }],
    }),
    // Куски сразу по нескольким группам — агрегат "все ли куски набора
    // готовы" для глобальных кнопок уровня страницы
    // (widgets/insulation-global-actions), независимо от того, что уже
    // закешировали отдельные InsulationGroupItem.
    getPiecesForGroups: builder.query<InsulationPieceWithQuantity[], InsulationGroupId[]>({
      query: (groupIds) => ({
        collection: 'group_pieces',
        method: 'getFullList',
        params: {
          filter: groupIds.map((groupId) => pb.filter('group = {:groupId}', { groupId })).join(' || '),
          sort: 'order',
          expand: 'piece',
        },
      }),
      transformResponse: toPiecesWithQuantity,
      providesTags: (result, _error, groupIds) => [
        ...(result?.map(({ id }) => ({ type: 'InsulationPiece' as const, id })) ?? []),
        ...groupIds.map((groupId) => ({ type: 'InsulationPiece' as const, id: `GROUP_${groupId}` })),
      ],
    }),
  }),
})

export const { useGetPiecesForGroupQuery, useGetPiecesForGroupsQuery } = insulationPieceApi
