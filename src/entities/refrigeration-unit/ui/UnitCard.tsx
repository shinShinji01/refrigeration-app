import { ComponentCard } from '@/shared/ui'
import { COMPONENT_TYPES } from '@/shared/config'
import type { RefrigerationUnit } from '../model/types'

interface UnitCardProps {
  unit: RefrigerationUnit
}

export const UnitCard = ({ unit }: UnitCardProps) => {
  const { color, icon } = COMPONENT_TYPES.unit
  // Если чертёж не заполнен — показываем id (docs/spec.md → "Общие моменты").
  const subtitle = unit.drawingNumbers.length > 0 ? unit.drawingNumbers.join(', ') : unit.id

  return (
    <ComponentCard
      icon={icon}
      accentColor={color}
      title={unit.name}
      subtitle={subtitle}
      isArchived={unit.isArchived}
    />
  )
}
