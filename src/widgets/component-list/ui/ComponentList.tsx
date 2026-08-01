import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import { UnitCard } from '@/entities/refrigeration-unit'
import { EmptyState } from '@/shared/ui'
import styles from './ComponentList.module.scss'

interface ComponentListProps {
  units: RefrigerationUnit[]
  isLoading: boolean
}

// Пока только карточки установок. Сборочные узлы и детали появятся в общем
// списке вместе с каскадными дропдаунами (docs/structure.md).
export const ComponentList = ({ units, isLoading }: ComponentListProps) => {
  if (isLoading) {
    return null
  }

  if (units.length === 0) {
    return <EmptyState message="Ничего не найдено" />
  }

  return (
    <div className={styles.grid}>
      {units.map((unit) => (
        <UnitCard key={unit.id} unit={unit} />
      ))}
    </div>
  )
}
