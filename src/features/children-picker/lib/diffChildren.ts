export interface ChildLink {
  // null — элемент добавлен в форме, ещё нет join-записи в БД.
  linkId: string | null
  id: string
  quantity: number
}

export interface ChildrenDiff {
  toCreate: { id: string; quantity: number }[]
  toUpdate: { linkId: string; quantity: number }[]
  toDelete: string[]
}

// Сравнивает состав на момент открытия модалки с тем, что осталось в форме
// к моменту "Сохранить" — используется вместо немедленных мутаций на каждый
// клик, чтобы Отмена/Escape отменяли и изменения состава тоже (docs/spec.md).
export const diffChildren = (original: ChildLink[], current: ChildLink[]): ChildrenDiff => {
  const originalByLinkId = new Map(original.map((item) => [item.linkId, item]))

  const toCreate = current
    .filter((item) => item.linkId === null)
    .map((item) => ({ id: item.id, quantity: item.quantity }))

  const toUpdate = current
    .filter((item): item is ChildLink & { linkId: string } => item.linkId !== null)
    .filter((item) => originalByLinkId.get(item.linkId)?.quantity !== item.quantity)
    .map((item) => ({ linkId: item.linkId, quantity: item.quantity }))

  const currentLinkIds = new Set(
    current.map((item) => item.linkId).filter((linkId): linkId is string => linkId !== null),
  )
  const toDelete = original
    .filter((item) => item.linkId !== null && !currentLinkIds.has(item.linkId))
    .map((item) => item.linkId as string)

  return { toCreate, toUpdate, toDelete }
}
