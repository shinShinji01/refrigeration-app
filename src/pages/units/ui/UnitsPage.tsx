import { useState } from 'react'
import { useFilteredComponents, CascadeBreadcrumbs } from '@/features/cascade-filter'
import { FilterBar } from '@/widgets/filter-bar'
import { ComponentList } from '@/widgets/component-list'
import { useDebounce } from '@/shared/lib/hooks'
import styles from './UnitsPage.module.scss'

export const UnitsPage = () => {
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const { parent, childItems, isLoading, isGlobalSearch } = useFilteredComponents({
    search: debouncedSearch,
    includeArchived,
  })

  return (
    <div className={styles.root}>
      <h1>Сборочные единицы</h1>
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        includeArchived={includeArchived}
        onIncludeArchivedChange={setIncludeArchived}
      />
      <CascadeBreadcrumbs includeArchived={includeArchived} />
      <ComponentList
        parent={parent}
        childItems={childItems}
        isLoading={isLoading}
        enableDrilldown={!isGlobalSearch}
      />
    </div>
  )
}
