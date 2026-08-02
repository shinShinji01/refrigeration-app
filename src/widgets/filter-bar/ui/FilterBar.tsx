import { Checkbox } from '@/shared/ui'
import { CascadeFilter } from '@/features/cascade-filter'
import { SortButton } from '@/features/card-sort'
import styles from './FilterBar.module.scss'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  includeArchived: boolean
  onIncludeArchivedChange: (value: boolean) => void
}

export const FilterBar = ({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
}: FilterBarProps) => (
  <div className={styles.root}>
    <div className={styles.row}>
      <input
        type="search"
        className={styles.search}
        placeholder="Название или номер чертежа"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label="Поиск"
      />
      <Checkbox
        id="filter-bar-archived"
        checked={includeArchived}
        onCheckedChange={onIncludeArchivedChange}
        label="Показать архивные"
      />
    </div>
    <div className={styles.filterRow}>
      <div className={styles.cascadeSlot}>
        <CascadeFilter includeArchived={includeArchived} />
      </div>
      <SortButton />
    </div>
  </div>
)
