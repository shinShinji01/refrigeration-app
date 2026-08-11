import { useState } from 'react'
import { useLocalStorageState } from '@/shared/lib/hooks'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'

export type InsulationListView = 'byGroup' | 'byThickness'

// Открытые группы аккордеона — обычный локальный стейт, НЕ персистится
// (docs/superpowers/specs/2026-08-10-...: персистятся только вид и флажок
// детализации). При смене набора InsulationGroupList пересоздаётся через
// key={selectedSetId} в InsulationPage, так что "все группы развёрнуты по
// умолчанию" сохраняется без явного сброса при смене версии. Сброс именно
// ПРИ смене состава groups в рамках одного монтирования (первая загрузка
// данных) — через паттерн "adjusting state when a prop changes" (тот же
// приём, что prevIsPending в InsulationGroupItem).
export const useInsulationGroupList = (groups: InsulationGroupWithQuantity[]) => {
  const groupLinkIds = groups.map((group) => group.linkId)
  const groupLinkIdsKey = groupLinkIds.join(',')

  const [openGroupIds, setOpenGroupIds] = useState<string[]>(groupLinkIds)
  const [prevGroupLinkIdsKey, setPrevGroupLinkIdsKey] = useState(groupLinkIdsKey)
  if (groupLinkIdsKey !== prevGroupLinkIdsKey) {
    setPrevGroupLinkIdsKey(groupLinkIdsKey)
    setOpenGroupIds(groupLinkIds)
  }

  const areAllGroupsOpen = groupLinkIds.length > 0 && openGroupIds.length === groupLinkIds.length
  const toggleAllGroups = () => setOpenGroupIds(areAllGroupsOpen ? [] : groupLinkIds)

  const [activeView, setActiveView] = useLocalStorageState<InsulationListView>('insulation.view', 'byGroup')
  const [detailed, setDetailed] = useLocalStorageState<boolean>('insulation.detailedCards', true)

  return {
    openGroupIds,
    onOpenGroupIdsChange: setOpenGroupIds,
    areAllGroupsOpen,
    toggleAllGroups,
    activeView,
    setActiveView,
    detailed,
    setDetailed,
  }
}
