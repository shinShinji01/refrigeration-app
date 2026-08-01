interface Searchable {
  name: string
  drawingNumbers: string[]
  isArchived: boolean
}

// Клиентский фильтр для уже загруженного списка детей (узлы установки, детали
// узла) — списки небольшие (docs/sample-data.md), отдельный запрос не нужен.
export const filterChildren = <T extends Searchable>(
  children: T[],
  search: string,
  includeArchived: boolean,
): T[] => {
  const query = search.trim().toLowerCase()

  return children.filter((child) => {
    if (!includeArchived && child.isArchived) {
      return false
    }
    if (!query) {
      return true
    }
    return (
      child.name.toLowerCase().includes(query) ||
      child.drawingNumbers.some((drawingNumber) => drawingNumber.toLowerCase().includes(query))
    )
  })
}
