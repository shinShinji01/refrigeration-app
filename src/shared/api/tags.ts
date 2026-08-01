export const TAG_TYPES = [
  'Unit',
  'Assembly',
  'Part',
  'InsulationSet',
  'InsulationGroup',
  'InsulationPiece',
  'CuttingSession',
  'StockSession',
  'User',
] as const

export type TagType = (typeof TAG_TYPES)[number]
