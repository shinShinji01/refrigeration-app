import { memo, useCallback } from 'react'
import { useModal } from '@/app/providers'
import { UnitCard } from '@/entities/refrigeration-unit'
import { AssemblyCard } from '@/entities/assembly'
import { PartCard } from '@/entities/part'
import { useCascadeFilter } from '@/features/cascade-filter'
import type { ComponentListItem } from '@/features/cascade-filter'
import { EDIT_COMPONENT_MODAL } from '@/features/component-edit'

interface ComponentListCardProps {
  item: ComponentListItem
  itemKey: string
  selected: boolean
  onToggleSelected: (key: string) => void
  compact?: boolean
  // Клик-навигация по карточкам-детям выключена в результатах глобального
  // поиска (docs/superpowers/specs/2026-08-14-units-card-navigation-design.md).
  enableDrilldown: boolean
}

// memo — карточек в списке могут быть сотни (CLAUDE.md → "Оптимизация").
// onToggleSelected — стабильная ссылка из useCardSelection, itemKey — примитив,
// поэтому смена выделения одной карточки не перерисовывает остальные.
export const ComponentListCard = memo(
  ({ item, itemKey, selected, onToggleSelected, compact, enableDrilldown }: ComponentListCardProps) => {
    const { open } = useModal()
    const { selectUnit, selectAssembly } = useCascadeFilter()
    const onSelectedChange = useCallback(() => onToggleSelected(itemKey), [onToggleSelected, itemKey])
    const onEdit = useCallback(() => open(EDIT_COMPONENT_MODAL, { item }), [open, item])
    const canOpen = compact && enableDrilldown

    switch (item.kind) {
      case 'unit':
        return (
          <UnitCard
            unit={item.unit}
            selected={selected}
            onSelectedChange={onSelectedChange}
            onEdit={onEdit}
            compact={compact}
            onOpen={canOpen ? () => selectUnit(item.unit.id) : undefined}
          />
        )
      case 'assembly':
        return (
          <AssemblyCard
            assembly={item.assembly}
            quantity={item.quantity}
            selected={selected}
            onSelectedChange={onSelectedChange}
            onEdit={onEdit}
            compact={compact}
            onOpen={canOpen ? () => selectAssembly(item.assembly.id) : undefined}
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
            compact={compact}
          />
        )
    }
  },
)
