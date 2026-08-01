import type { ComponentType, SVGProps } from 'react'
import MenuUnitsIcon from '@/shared/assets/icons/menu-units.svg?react'
import MenuStockIcon from '@/shared/assets/icons/menu-stock.svg?react'
import MenuInsulationIcon from '@/shared/assets/icons/menu-insulation.svg?react'
import MenuStatsIcon from '@/shared/assets/icons/menu-stats.svg?react'
import MenuSettingsIcon from '@/shared/assets/icons/menu-settings.svg?react'
import { paths } from './paths'

export interface MenuItem {
  id: string
  path: string | null
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  isDisabled: boolean
}

// Пункты сайдбара — не вшиты в компонент, а собраны здесь одним списком
// (docs/structure.md → "Меню сайдбара").
export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'units',
    path: paths.units,
    label: 'Сборочные единицы',
    icon: MenuUnitsIcon,
    isDisabled: false,
  },
  {
    id: 'stock',
    path: paths.stock,
    label: 'Подсчёт наличия',
    icon: MenuStockIcon,
    isDisabled: false,
  },
  {
    id: 'insulation',
    path: paths.insulation,
    label: 'Изоляция и раскрой',
    icon: MenuInsulationIcon,
    isDisabled: false,
  },
  {
    id: 'stats',
    path: null,
    label: 'Статистика',
    icon: MenuStatsIcon,
    isDisabled: true,
  },
  {
    id: 'settings',
    path: null,
    label: 'Настройки',
    icon: MenuSettingsIcon,
    isDisabled: true,
  },
]
