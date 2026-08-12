import * as Accordion from '@radix-ui/react-accordion'
import * as Tabs from '@radix-ui/react-tabs'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { InsulationGroupItem } from './InsulationGroupItem'
import { InsulationListToolbar } from './InsulationListToolbar'
import { InsulationThicknessList } from './InsulationThicknessList'
import { useInsulationGroupList } from '../model/useInsulationGroupList'
import type { InsulationListView } from '../model/useInsulationGroupList'
import styles from './InsulationGroupList.module.scss'

interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  getPieceDoneCount: (groupPieceId: string, quantity: number) => number
  onSetPieceCount: (groupPieceId: string, count: number) => void
  pendingGroupIds: ReadonlySet<string>
  onSetGroupDone: (groupId: string, pieces: { linkId: string; quantity: number }[], done: boolean) => void
}

const isInsulationListView = (value: string): value is InsulationListView =>
  value === 'byGroup' || value === 'byThickness'

// Два вида одного и того же набора кусков — по группам (аккордеон,
// сворачивание, кнопки массовой отметки — см. InsulationGroupItem) и по
// толщине (сквозной плоский список, InsulationThicknessList) — переключаются
// табами; вид и флажок подробной информации персистятся в localStorage через
// useInsulationGroupList (docs/superpowers/specs/2026-08-10-...).
export const InsulationGroupList = ({
  groups,
  isLoading,
  getPieceDoneCount,
  onSetPieceCount,
  pendingGroupIds,
  onSetGroupDone,
}: InsulationGroupListProps) => {
  const {
    openGroupIds,
    onOpenGroupIdsChange,
    areAllGroupsOpen,
    toggleAllGroups,
    activeView,
    setActiveView,
    detailed,
    setDetailed,
  } = useInsulationGroupList(groups)

  if (isLoading) {
    return null
  }

  if (groups.length === 0) {
    return <EmptyState message="У набора нет групп изоляции" />
  }

  return (
    <Tabs.Root
      className={styles.root}
      value={activeView}
      onValueChange={(value) => {
        if (isInsulationListView(value)) setActiveView(value)
      }}
    >
      <InsulationListToolbar
        activeView={activeView}
        areAllGroupsOpen={areAllGroupsOpen}
        onToggleAllGroups={toggleAllGroups}
        detailed={detailed}
        onDetailedChange={setDetailed}
      />
      <Tabs.Content value="byGroup">
        <Accordion.Root
          type="multiple"
          value={openGroupIds}
          onValueChange={onOpenGroupIdsChange}
          className={styles.list}
        >
          {groups.map((group) => (
            <InsulationGroupItem
              key={group.linkId}
              group={group}
              detailed={detailed}
              getPieceDoneCount={getPieceDoneCount}
              onSetPieceCount={onSetPieceCount}
              pendingGroupIds={pendingGroupIds}
              onSetGroupDone={onSetGroupDone}
            />
          ))}
        </Accordion.Root>
      </Tabs.Content>
      <Tabs.Content value="byThickness">
        <InsulationThicknessList
          groups={groups}
          detailed={detailed}
          getPieceDoneCount={getPieceDoneCount}
          onSetPieceCount={onSetPieceCount}
        />
      </Tabs.Content>
    </Tabs.Root>
  )
}
