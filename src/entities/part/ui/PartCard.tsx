import { ComponentCard, ChildrenSummaryList } from '@/shared/ui'
import { COMPONENT_TYPES } from '@/shared/config'
import { useGetPartChildrenQuery } from '../api/partApi'
import type { Part } from '../model/types'

interface PartCardProps {
  part: Part
  // Количество на узел — известно только в контексте конкретного узла
  // (assembly_parts), не в результатах глобального поиска.
  quantity?: number
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  onEdit?: () => void
}

// Рекурсивный состав детали (part_parts) показывается только текстом внутри
// карточки — отдельных карточек для дочерних деталей нет (docs/decisions.md №9).
export const PartCard = ({ part, quantity, selected, onSelectedChange, onEdit }: PartCardProps) => {
  const { color, icon } = COMPONENT_TYPES.part
  const { data: children = [] } = useGetPartChildrenQuery(part.id)

  const subtitle = part.drawingNumbers.length > 0 ? part.drawingNumbers.join(', ') : part.id
  const title = quantity === undefined ? part.name : `${part.name} × ${quantity}`

  return (
    <ComponentCard
      icon={icon}
      accentColor={color}
      title={title}
      subtitle={subtitle}
      isArchived={part.isArchived}
      selected={selected}
      onSelectedChange={onSelectedChange}
      onEdit={onEdit}
    >
      <ChildrenSummaryList
        items={children.map((child) => ({ id: child.id, label: child.name, quantity: child.quantity }))}
      />
    </ComponentCard>
  )
}
