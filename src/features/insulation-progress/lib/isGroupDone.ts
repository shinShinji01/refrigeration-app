export const isGroupDone = (pieceLinkIds: string[], isPieceDone: (linkId: string) => boolean): boolean =>
  pieceLinkIds.length > 0 && pieceLinkIds.every(isPieceDone)
