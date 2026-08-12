export const isGroupFullyDone = (
  pieces: { linkId: string; quantity: number }[],
  getDoneCount: (linkId: string, quantity: number) => number,
): boolean =>
  pieces.length > 0 && pieces.every((piece) => getDoneCount(piece.linkId, piece.quantity) >= piece.quantity)
