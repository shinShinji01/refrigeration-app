import { pb } from '@/shared/api'

export interface NameFilterParams {
  search: string
  includeArchived: boolean
}

// ?~ — обязателен для drawingNumbers (json-массив): обычный ~ на массивах
// PocketBase требует совпадения по всем элементам, ?~ — хотя бы по одному
// (см. https://pocketbase.io/docs/api-rules-and-filters — "any/at-least-one-of").
// Общий для units/assemblies/parts — у всех троих одинаковые name/drawingNumbers/isArchived.
export const buildNameFilter = ({ search, includeArchived }: NameFilterParams): string => {
  const clauses: string[] = []

  const trimmed = search.trim()
  if (trimmed) {
    clauses.push(pb.filter('(name ~ {:q} || drawingNumbers ?~ {:q})', { q: trimmed }))
  }

  if (!includeArchived) {
    clauses.push('isArchived = false')
  }

  return clauses.join(' && ')
}
