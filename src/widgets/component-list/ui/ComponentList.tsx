import type { ComponentListItem } from '@/features/cascade-filter'
import { UnitCard } from '@/entities/refrigeration-unit'
import { AssemblyCard } from '@/entities/assembly'
import { PartCard } from '@/entities/part'
import { EmptyState } from '@/shared/ui'
import styles from './ComponentList.module.scss'

interface ComponentListProps {
  items: ComponentListItem[]
  isLoading: boolean
  // Ничего не выбрано и поиск пуст — по ТЗ список пуст без сообщения
  // (docs/spec.md → "Список сборочных единиц").
  isIdle: boolean
}

export const ComponentList = ({ items, isLoading, isIdle }: ComponentListProps) => {
  if (isIdle || isLoading) {
    return null
  }

  if (items.length === 0) {
    return <EmptyState message="Ничего не найдено" />
  }

  return (
    <div className={styles.grid}>
      {items.map((item) => {
        switch (item.kind) {
          case 'unit':
            return <UnitCard key={`unit-${item.unit.id}`} unit={item.unit} />
          case 'assembly':
            return (
              <AssemblyCard key={`assembly-${item.assembly.id}`} assembly={item.assembly} quantity={item.quantity} />
            )
          case 'part':
            return <PartCard key={`part-${item.part.id}`} part={item.part} quantity={item.quantity} />
        }
      })}
    </div>
  )
}
