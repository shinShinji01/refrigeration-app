import type { BaseRecord } from '@/shared/api'
import type { Geometry } from '@/shared/lib/geometry'

export type InsulationPieceId = string & { readonly __brand: 'InsulationPieceId' }

export interface InsulationPiece extends BaseRecord {
  id: InsulationPieceId
  name: string
  drawingNumbers: string[]
  geometry: Geometry
  // Производное поле, денормализовано. Пересчёт — только через
  // shared/lib/geometry/withComputedArea(), больше нигде (docs/decisions.md №6).
  areaMm2: number
  thicknessMm: number
  hasAdhesive: boolean
  isArchived: boolean
}
