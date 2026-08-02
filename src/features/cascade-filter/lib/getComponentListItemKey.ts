import type { ComponentListItem } from './useFilteredComponents'

export const getComponentListItemKey = (item: ComponentListItem): string => {
  switch (item.kind) {
    case 'unit':
      return `unit-${item.unit.id}`
    case 'assembly':
      return `assembly-${item.assembly.id}`
    case 'part':
      return `part-${item.part.id}`
  }
}
