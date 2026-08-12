export const applyBulk = (
  donePieces: Record<string, number | true>,
  groupPieceIds: string[],
  done: boolean,
): Record<string, number | true> => {
  const next = { ...donePieces }
  for (const id of groupPieceIds) {
    if (done) {
      next[id] = true
    } else {
      delete next[id]
    }
  }
  return next
}
