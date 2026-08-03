import * as Accordion from '@radix-ui/react-accordion'
import { EmptyState } from '@/shared/ui'
import type { InsulationGroupWithQuantity } from '@/entities/insulation-group'
import { InsulationGroupItem } from './InsulationGroupItem'
import styles from './InsulationGroupList.module.scss'

interface InsulationGroupListProps {
  groups: InsulationGroupWithQuantity[]
  isLoading: boolean
  isPieceDone: (groupPieceId: string) => boolean
  onTogglePiece: (groupPieceId: string) => void
}

// Все группы развёрнуты по умолчанию — сворачивание индивидуальное
// (docs/spec.md → "кнопка сворачивания группы (аккордеон)").
export const InsulationGroupList = ({
  groups,
  isLoading,
  isPieceDone,
  onTogglePiece,
}: InsulationGroupListProps) => {
  const defaultValue = groups.map((group) => group.linkId)

  if (isLoading) {
    return null
  }

  if (groups.length === 0) {
    return <EmptyState message="У набора нет групп изоляции" />
  }

  return (
    <Accordion.Root type="multiple" defaultValue={defaultValue} className={styles.list}>
      {groups.map((group) => (
        <InsulationGroupItem
          key={group.linkId}
          group={group}
          isPieceDone={isPieceDone}
          onTogglePiece={onTogglePiece}
        />
      ))}
    </Accordion.Root>
  )
}
