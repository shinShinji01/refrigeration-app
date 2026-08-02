import { memo, useCallback } from 'react'
import { useModal } from '@/app/providers'
import { UnitCard } from '@/entities/refrigeration-unit'
import { AssemblyCard } from '@/entities/assembly'
import { PartCard } from '@/entities/part'
import type { ComponentListItem } from '@/features/cascade-filter'
import { EDIT_COMPONENT_MODAL } from '@/features/component-edit'

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
  const { open } = useModal()
  const onSelectedChange = useCallback(() => onToggleSelected(itemKey), [onToggleSelected, itemKey])
  const onEdit = useCallback(() => open(EDIT_COMPONENT_MODAL, { item }), [open, item])

  switch (item.kind) {
    case 'unit':
      return <UnitCard unit={item.unit} selected={selected} onSelectedChange={onSelectedChange} onEdit={onEdit} />
    case 'assembly':
      return (
        <AssemblyCard
          assembly={item.assembly}
          quantity={item.quantity}
          selected={selected}
          onSelectedChange={onSelectedChange}
          onEdit={onEdit}
        />
      )
    case 'part':
      return (
        <PartCard
          part={item.part}
          quantity={item.quantity}
          selected={selected}
          onSelectedChange={onSelectedChange}
          onEdit={onEdit}
        />
      )
  }
})
