import { memo, useCallback } from 'react'
import { UnitCard } from '@/entities/refrigeration-unit'
import { AssemblyCard } from '@/entities/assembly'
import { PartCard } from '@/entities/part'
import type { ComponentListItem } from '@/features/cascade-filter'

interface ComponentListCardProps {
  item: ComponentListItem
  itemKey: string
  selected: boolean
  onToggleSelected: (key: string) => void
}

// memo — карточек в списке могут быть сотни (CLAUDE.md → "Оптимизация").
// onToggleSelected — стабильная ссылка из useCardSelection, itemKey — примитив,
// поэтому смена выделения одной карточки не перерисовывает остальные.
export const ComponentListCard = memo(({ item, itemKey, selected, onToggleSelected }: ComponentListCardProps) => {
  const onSelectedChange = useCallback(() => onToggleSelected(itemKey), [onToggleSelected, itemKey])

  switch (item.kind) {
    case 'unit':
      return <UnitCard unit={item.unit} selected={selected} onSelectedChange={onSelectedChange} />
    case 'assembly':
      return (
        <AssemblyCard
          assembly={item.assembly}
          quantity={item.quantity}
          selected={selected}
          onSelectedChange={onSelectedChange}
        />
      )
    case 'part':
      return (
        <PartCard part={item.part} quantity={item.quantity} selected={selected} onSelectedChange={onSelectedChange} />
      )
  }
})
