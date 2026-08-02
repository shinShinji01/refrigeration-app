import type { ComponentListItem } from '@/features/cascade-filter'
import type { SortBy } from '../model/cardSortSlice'

// Порядок типов при сортировке "по типу" — установка → узел → деталь,
// сверху вниз по иерархии состава (docs/data-model.md).
const TYPE_ORDER: Record<ComponentListItem['kind'], number> = { unit: 0, assembly: 1, part: 2 }

const getName = (item: ComponentListItem): string =>
  item.kind === 'unit' ? item.unit.name : item.kind === 'assembly' ? item.assembly.name : item.part.name

const getIsArchived = (item: ComponentListItem): boolean =>
  item.kind === 'unit'
    ? item.unit.isArchived
    : item.kind === 'assembly'
      ? item.assembly.isArchived
      : item.part.isArchived

// PocketBase хранит незаполненную дату как "" (а не null) — || null нормализует оба случая.
const getDate = (item: ComponentListItem): string | null => {
  const value =
    item.kind === 'unit'
      ? item.unit.commissionedAt
      : item.kind === 'assembly'
        ? item.assembly.commissionedAt
        : item.part.commissionedAt
  return value || null
}

// Название — тай-брейк для "по типу" и "по дате", чтобы порядок был
// детерминированным и предсказуемым для пользователя, а не "как повезло".
// Архивные элементы всегда в конце, независимо от критерия сортировки.
export const sortComponentItems = (items: ComponentListItem[], sortBy: SortBy): ComponentListItem[] => {
  const byName = (a: ComponentListItem, b: ComponentListItem) => getName(a).localeCompare(getName(b), 'ru')

  return [...items].sort((a, b) => {
    const archivedDiff = Number(getIsArchived(a)) - Number(getIsArchived(b))
    if (archivedDiff !== 0) return archivedDiff

    switch (sortBy) {
      case 'name':
        return byName(a, b)
      case 'type': {
        const typeDiff = TYPE_ORDER[a.kind] - TYPE_ORDER[b.kind]
        return typeDiff !== 0 ? typeDiff : byName(a, b)
      }
      case 'date': {
        const dateA = getDate(a)
        const dateB = getDate(b)
        if (dateA === null && dateB === null) return byName(a, b)
        if (dateA === null) return 1
        if (dateB === null) return -1
        return dateA === dateB ? byName(a, b) : dateA.localeCompare(dateB)
      }
    }
  })
}

export interface SplitByArchivedResult {
  active: ComponentListItem[]
  archived: ComponentListItem[]
}

// Для визуального разделения (перенос на следующую секцию) — используется
// вместе с уже отсортированным (sortComponentItems кладёт архивные в конец)
// списком, но не полагается на это: делит по isArchived самостоятельно.
export const splitByArchived = (items: ComponentListItem[]): SplitByArchivedResult => {
  const active: ComponentListItem[] = []
  const archived: ComponentListItem[] = []
  for (const item of items) {
    const bucket = getIsArchived(item) ? archived : active
    bucket.push(item)
  }
  return { active, archived }
}
