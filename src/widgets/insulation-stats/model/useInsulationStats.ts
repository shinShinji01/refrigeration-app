import { skipToken } from '@reduxjs/toolkit/query/react'
import { useGetInsulationSetStatsQuery } from '@/entities/insulation-piece'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'

export interface GroupAreaEntry {
  id: string
  label: string
  areaM2: number
}

export const useInsulationStats = (groups: InsulationGroupWithQuantity[]) => {
  const groupIds = groups.map((group) => group.id)
  // currentData (не data) и isFetching (не isLoading) — тот же паттерн
  // защиты от гонки версий набора, что и в InsulationPage/
  // useInsulationGlobalActions: иначе на смене версии currentData
  // какое-то время отдаёт статистику СТАРОЙ версии при уже новых groupIds.
  const { currentData, isFetching } = useGetInsulationSetStatsQuery(
    groupIds.length === 0 ? skipToken : groupIds,
  )

  const byGroup: GroupAreaEntry[] = (currentData?.byGroup ?? [])
    .map((entry) => ({
      id: entry.groupId,
      label: groups.find((group) => group.id === entry.groupId)?.name ?? '—',
      areaM2: entry.areaM2,
    }))
    .sort((a, b) => b.areaM2 - a.areaM2)

  const byThickness = currentData?.byThickness ?? []
  const totalAreaM2 = byGroup.reduce((sum, entry) => sum + entry.areaM2, 0)

  return { byGroup, byThickness, totalAreaM2, isLoading: isFetching }
}
