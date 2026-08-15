import type { ComponentListItem } from '@/features/cascade-filter'
import { getComponentListItemKey } from '@/features/cascade-filter'
import { useCardSelection } from '@/features/card-selection'
import { useCardSort, sortComponentItems, splitByArchived } from '@/features/card-sort'
import { SelectionToolbar, useBulkActions } from '@/widgets/selection-toolbar'
import { EmptyState } from '@/shared/ui'
import { ComponentListCard } from './ComponentListCard'
import styles from './ComponentList.module.scss'

interface ComponentListProps {
  parent: ComponentListItem | null
  childItems: ComponentListItem[]
  isLoading: boolean
  enableDrilldown: boolean
}

const renderCard = (
  item: ComponentListItem,
  isSelected: (key: string) => boolean,
  toggleSelected: (key: string) => void,
  enableDrilldown: boolean,
  compact?: boolean,
) => {
  const itemKey = getComponentListItemKey(item)
  return (
    <ComponentListCard
      key={itemKey}
      item={item}
      itemKey={itemKey}
      selected={isSelected(itemKey)}
      onToggleSelected={toggleSelected}
      compact={compact}
      enableDrilldown={enableDrilldown}
    />
  )
}

// Архивные — отдельной секцией в конце, с переносом на новую строку, а не
// вперемешку с активными (docs/spec.md → "Список карточек"). compact — карточки
// в сетке всегда одной высоты с обрезкой лишнего (не относится к выбранной слева).
const renderGrid = (
  items: ComponentListItem[],
  isSelected: (key: string) => boolean,
  toggleSelected: (key: string) => void,
  enableDrilldown: boolean,
) => {
  const { active, archived } = splitByArchived(items)
  return (
    <>
      <div className={styles.grid}>
        {active.map((item) => renderCard(item, isSelected, toggleSelected, enableDrilldown, true))}
      </div>
      {archived.length > 0 ? (
        <>
          <div className={styles.archivedDivider}>Архив</div>
          <div className={styles.grid}>
            {archived.map((item) => renderCard(item, isSelected, toggleSelected, enableDrilldown, true))}
          </div>
        </>
      ) : null}
    </>
  )
}

// При выбранном родителе (установка/узел) с непустыми детьми — раскладка
// в две ячейки: слева сам родитель, справа сетка его детей. Иначе — обычная
// плоская сетка (список установок, глобальный поиск, лист без детей).
export const ComponentList = ({ parent, childItems, isLoading, enableDrilldown }: ComponentListProps) => {
  const { isSelected, toggleSelected } = useCardSelection()
  const { sortBy } = useCardSort()

  const allItems = parent ? [parent, ...childItems] : childItems
  const selectedItems = allItems.filter((item) => isSelected(getComponentListItemKey(item)))
  const { isBusy, archiveSelected, unarchiveSelected, deleteSelected } = useBulkActions(selectedItems)

  if (isLoading) {
    return null
  }

  const toolbar = (
    <SelectionToolbar
      count={selectedItems.length}
      isBusy={isBusy}
      onArchive={archiveSelected}
      onUnarchive={unarchiveSelected}
      onDelete={deleteSelected}
    />
  )

  if (parent && childItems.length > 0) {
    const sortedChildren = sortComponentItems(childItems, sortBy)
    return (
      <>
        {toolbar}
        <div className={styles.split}>
          <div className={styles.parentCell}>{renderCard(parent, isSelected, toggleSelected, false)}</div>
          <div className={styles.childrenCell}>
            {renderGrid(sortedChildren, isSelected, toggleSelected, enableDrilldown)}
          </div>
        </div>
      </>
    )
  }

  if (parent) {
    return (
      <>
        {toolbar}
        <div className={styles.grid}>{renderCard(parent, isSelected, toggleSelected, false)}</div>
      </>
    )
  }

  const items = sortComponentItems(childItems, sortBy)
  if (items.length === 0) {
    return <EmptyState message="Ничего не найдено" />
  }

  return (
    <>
      {toolbar}
      {renderGrid(items, isSelected, toggleSelected, enableDrilldown)}
    </>
  )
}
