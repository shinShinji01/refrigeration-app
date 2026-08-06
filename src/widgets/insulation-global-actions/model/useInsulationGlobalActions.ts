import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetPiecesForGroupsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { isGroupDone } from '@/features/insulation-progress'

export const useInsulationGlobalActions = (
  groups: InsulationGroupWithQuantity[],
  isPieceDone: (groupPieceId: string) => boolean,
) => {
  const groupIds = groups.map((group) => group.id)
  // currentData (не data) и isFetching (не isLoading) — иначе на смене версии
  // набора один рендер отдаёт куски СТАРОЙ версии при уже новом groupIds
  // (RTK Query отдаёт data от предыдущего arg, пока грузится новый). Клик по
  // «отметить всё готовым» в этот момент записал бы старые piece id в новую
  // сессию donePieces. currentData/isFetching гарантируют, что до появления
  // данных именно текущей версии allPieceIds пуст, а isLoading — true.
  const { currentData: pieces = [], isFetching } = useGetPiecesForGroupsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const allPieceIds = pieces.map((piece) => piece.linkId)
  const allDone = isGroupDone(allPieceIds, isPieceDone)
  const hasAnyDone = pieces.some((piece) => isPieceDone(piece.linkId))

  return { allPieceIds, allDone, hasAnyDone, isLoading: isFetching }
}
