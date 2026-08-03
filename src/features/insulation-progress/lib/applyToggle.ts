export const applyToggle = (
  donePieces: Record<string, true>,
  groupPieceId: string,
): Record<string, true> => {
  if (donePieces[groupPieceId]) {
    const rest = { ...donePieces }
    delete rest[groupPieceId]
    return rest
  }
  return { ...donePieces, [groupPieceId]: true }
}
