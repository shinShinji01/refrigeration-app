import type { ComponentType, SVGProps } from 'react'
import TypeUnitIcon from '@/shared/assets/icons/type-unit.svg?react'
import TypeAssemblyIcon from '@/shared/assets/icons/type-assembly.svg?react'
import TypePartIcon from '@/shared/assets/icons/type-part.svg?react'

export type ComponentKind = 'unit' | 'assembly' | 'part'

export interface ComponentTypeConfig {
  label: string
  color: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

// Единая таблица цвет/иконка/подпись по типам карточек на всё приложение
// (docs/structure.md → "Три типа карточек — один компонент"). Цвета — не
// cyan/янтарный/красный, те зарезервированы под состояния (docs/CLAUDE.md).
export const COMPONENT_TYPES: Record<ComponentKind, ComponentTypeConfig> = {
  unit: {
    label: 'Холодильная установка',
    color: '#5b6eae',
    icon: TypeUnitIcon,
  },
  assembly: {
    label: 'Сборочный узел',
    color: '#4c8577',
    icon: TypeAssemblyIcon,
  },
  part: {
    label: 'Деталь',
    color: '#8c6d9c',
    icon: TypePartIcon,
  },
}
