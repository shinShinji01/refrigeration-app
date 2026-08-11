import * as Tabs from '@radix-ui/react-tabs'
import { Checkbox } from '@/shared/ui'
import type { InsulationListView } from '../model/useInsulationGroupList'
import styles from './InsulationListToolbar.module.scss'

interface InsulationListToolbarProps {
  activeView: InsulationListView
  areAllGroupsOpen: boolean
  onToggleAllGroups: () => void
  detailed: boolean
  onDetailedChange: (detailed: boolean) => void
}

// Панель управления списком кусков изоляции: таб-переключатель вида,
// тумблер свернуть/развернуть все группы (только для вида "по группам") и
// флажок подробной информации на карточках (docs/superpowers/specs/
// 2026-08-10-insulation-view-controls-design.md). Tabs.List/Trigger должны
// рендериться внутри Tabs.Root — это обеспечивает родитель
// (InsulationGroupList), сюда компонент попадает как обычный child.
export const InsulationListToolbar = ({
  activeView,
  areAllGroupsOpen,
  onToggleAllGroups,
  detailed,
  onDetailedChange,
}: InsulationListToolbarProps) => (
  <div className={styles.root}>
    <Tabs.List className={styles.tabs}>
      <Tabs.Trigger value="byGroup" className={styles.tab}>
        По группам
      </Tabs.Trigger>
      <Tabs.Trigger value="byThickness" className={styles.tab}>
        По толщине
      </Tabs.Trigger>
    </Tabs.List>
    {activeView === 'byGroup' ? (
      <button type="button" className={styles.collapseToggle} onClick={onToggleAllGroups}>
        {areAllGroupsOpen ? 'Свернуть все' : 'Развернуть все'}
      </button>
    ) : null}
    <Checkbox
      id="insulation-detailed-cards"
      checked={detailed}
      onCheckedChange={onDetailedChange}
      label="Подробная информация"
    />
  </div>
)
