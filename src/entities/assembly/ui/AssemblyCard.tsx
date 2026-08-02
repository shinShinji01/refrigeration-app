import { ComponentCard, ChildrenSummaryList } from '@/shared/ui'
import { COMPONENT_TYPES } from '@/shared/config'
import { useGetPartsForAssemblyQuery } from '@/entities/part'
import type { Assembly } from '../model/types'

interface AssemblyCardProps {
  assembly: Assembly
  // Количество на установку — известно только когда узел показан в контексте
  // конкретной установки (unit_assemblies), не в результатах глобального поиска.
  quantity?: number
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
  onEdit?: () => void
  compact?: boolean
}

export const AssemblyCard = ({ assembly, quantity, selected, onSelectedChange, onEdit, compact }: AssemblyCardProps) => {
  const { color, icon } = COMPONENT_TYPES.assembly
  const { data: parts = [] } = useGetPartsForAssemblyQuery(assembly.id)

  const subtitle = assembly.drawingNumbers.length > 0 ? assembly.drawingNumbers.join(', ') : assembly.id
  const title = quantity === undefined ? assembly.name : `${assembly.name} × ${quantity}`

  return (
    <ComponentCard
      icon={icon}
      accentColor={color}
      title={title}
      subtitle={subtitle}
      isArchived={assembly.isArchived}
      selected={selected}
      onSelectedChange={onSelectedChange}
      onEdit={onEdit}
      compact={compact}
    >
      <ChildrenSummaryList
        items={parts.map((part) => ({ id: part.id, label: part.name, quantity: part.quantity }))}
      />
    </ComponentCard>
  )
}
