import { Checkbox } from '@/shared/ui'
import styles from './FilterBar.module.scss'

interface FilterBarProps {
  search: string
  onSearchChange: (value: string) => void
  includeArchived: boolean
  onIncludeArchivedChange: (value: boolean) => void
}

// Каскадные дропдауны (установка → узел → деталь) — следующий проход,
// см. features/cascade-filter в docs/structure.md.
export const FilterBar = ({
  search,
  onSearchChange,
  includeArchived,
  onIncludeArchivedChange,
}: FilterBarProps) => (
  <div className={styles.root}>
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
)
