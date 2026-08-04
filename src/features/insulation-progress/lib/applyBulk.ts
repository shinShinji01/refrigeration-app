export const applyBulk = (
  donePieces: Record<string, true>,
  groupPieceIds: string[],
  done: boolean,
): Record<string, true> => {
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
