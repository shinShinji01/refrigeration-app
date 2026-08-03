export const applyToggle = (
  donePieces: Record<string, true>,
  groupPieceId: string,
): Record<string, true> => {
  if (donePieces[groupPieceId]) {
    const { [groupPieceId]: _removed, ...rest } = donePieces
    return rest
  }
  return { ...donePieces, [groupPieceId]: true }
}
