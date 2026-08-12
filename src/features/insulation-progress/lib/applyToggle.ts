export const applyToggle = (
  donePieces: Record<string, number | true>,
  groupPieceId: string,
): Record<string, number | true> => {
  if (donePieces[groupPieceId]) {
    const rest = { ...donePieces }
    delete rest[groupPieceId]
    return rest
  }
  return { ...donePieces, [groupPieceId]: true }
}
