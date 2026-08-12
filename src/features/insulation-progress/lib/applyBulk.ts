export const applyBulk = (
  donePieces: Record<string, number | true>,
  pieces: { linkId: string; quantity: number }[],
  done: boolean,
): Record<string, number | true> => {
  const next = { ...donePieces }
  for (const { linkId, quantity } of pieces) {
    if (done) {
      next[linkId] = quantity
    } else {
      delete next[linkId]
    }
  }
  return next
}
