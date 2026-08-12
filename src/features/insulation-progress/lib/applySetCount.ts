export const applySetCount = (
  donePieces: Record<string, number | true>,
  groupPieceId: string,
  count: number,
): Record<string, number | true> => {
  if (count <= 0) {
    const rest = { ...donePieces }
    delete rest[groupPieceId]
    return rest
  }
  return { ...donePieces, [groupPieceId]: count }
}
