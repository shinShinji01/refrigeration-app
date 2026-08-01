import { useState } from 'react'
import { useGetUnitsQuery } from '@/entities/refrigeration-unit'
import { FilterBar } from '@/widgets/filter-bar'
import { ComponentList } from '@/widgets/component-list'
import { useDebounce } from '@/shared/lib/hooks'
import styles from './UnitsPage.module.scss'

export const UnitsPage = () => {
  const [search, setSearch] = useState('')
  const [includeArchived, setIncludeArchived] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const { data: units = [], isLoading } = useGetUnitsQuery({
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
      <ComponentList units={units} isLoading={isLoading} />
    </div>
  )
}
