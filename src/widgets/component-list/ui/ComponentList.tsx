import type { ComponentListItem } from '@/features/cascade-filter'
import { getComponentListItemKey } from '@/features/cascade-filter'
import { useCardSelection } from '@/features/card-selection'
import { useCardSort, sortComponentItems, SortButton } from '@/features/card-sort'
import { SelectionToolbar, useBulkActions } from '@/widgets/selection-toolbar'
import { EmptyState } from '@/shared/ui'
import { ComponentListCard } from './ComponentListCard'
import styles from './ComponentList.module.scss'

interface ComponentListProps {
  parent: ComponentListItem | null
  childItems: ComponentListItem[]
  isLoading: boolean
}

const renderCard = (
  item: ComponentListItem,
  isSelected: (key: string) => boolean,
  toggleSelected: (key: string) => void,
) => {
  const itemKey = getComponentListItemKey(item)
  return (
    <ComponentListCard
      key={itemKey}
      item={item}
      itemKey={itemKey}
      selected={isSelected(itemKey)}
      onToggleSelected={toggleSelected}
    />
  )
}

// При выбранном родителе (установка/узел) с непустыми детьми — раскладка
// в две ячейки: слева сам родитель, справа сетка его детей. Иначе — обычная
// плоская сетка (список установок, глобальный поиск, лист без детей).
export const ComponentList = ({ parent, childItems, isLoading }: ComponentListProps) => {
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
          <div className={styles.parentCell}>{renderCard(parent, isSelected, toggleSelected)}</div>
          <div className={styles.childrenCell}>
            <div className={styles.controls}>
              <SortButton />
            </div>
            <div className={styles.grid}>
              {sortedChildren.map((item) => renderCard(item, isSelected, toggleSelected))}
            </div>
          </div>
        </div>
      </>
    )
  }

  const items = parent ? [parent] : sortComponentItems(childItems, sortBy)
  if (items.length === 0) {
    return <EmptyState message="Ничего не найдено" />
  }

  return (
    <>
      {toolbar}
      {parent ? null : (
        <div className={styles.controls}>
          <SortButton />
        </div>
      )}
      <div className={styles.grid}>{items.map((item) => renderCard(item, isSelected, toggleSelected))}</div>
    </>
  )
}
