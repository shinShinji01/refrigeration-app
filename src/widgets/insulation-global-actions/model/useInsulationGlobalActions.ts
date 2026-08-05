import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetPiecesForGroupsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'

export const useInsulationGlobalActions = (
  groups: InsulationGroupWithQuantity[],
  isPieceDone: (groupPieceId: string) => boolean,
) => {
  const groupIds = groups.map((group) => group.id)
  const { data: pieces = [], isLoading } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const allPieceIds = pieces.map((piece) => piece.linkId)
  const allDone = isGroupDone(allPieceIds, isPieceDone)
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))

  return { allPieceIds, allDone, hasAnyDone, isLoading }
}
