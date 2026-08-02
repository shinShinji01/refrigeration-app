import { ComponentCard, ChildrenSummaryList } from '@/shared/ui'
import { COMPONENT_TYPES } from '@/shared/config'
import { useGetAssembliesForUnitQuery } from '@/entities/assembly'
import type { RefrigerationUnit } from '../model/types'

interface UnitCardProps {
  unit: RefrigerationUnit
  selected?: boolean
  onSelectedChange?: (selected: boolean) => void
}

export const UnitCard = ({ unit, selected, onSelectedChange }: UnitCardProps) => {
  const { color, icon } = COMPONENT_TYPES.unit
  const { data: assemblies = [] } = useGetAssembliesForUnitQuery(unit.id)
  // Если чертёж не заполнен — показываем id (docs/spec.md → "Общие моменты").
  const subtitle = unit.drawingNumbers.length > 0 ? unit.drawingNumbers.join(', ') : unit.id

  return (
    <ComponentCard
      icon={icon}
      accentColor={color}
      title={unit.name}
      subtitle={subtitle}
      isArchived={unit.isArchived}
      selected={selected}
      onSelectedChange={onSelectedChange}
    >
      <ChildrenSummaryList
        items={assemblies.map((assembly) => ({
          id: assembly.id,
          label: assembly.name,
          quantity: assembly.quantity,
        }))}
      />
    </ComponentCard>
  )
}
