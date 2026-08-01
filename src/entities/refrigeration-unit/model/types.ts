import type { BaseRecord, IsoDateString } from '@/shared/api'

export type UnitId = string & { readonly __brand: 'UnitId' }

export interface RefrigerationUnit extends BaseRecord {
  id: UnitId
  name: string
  drawingNumbers: string[]
  commissionedAt: IsoDateString | null
  lastCompletedUnitNo: number | null
  lastCompletedUnitNoInsulation: number | null
  lastCompletedUnitNoAssembly: number | null
  isArchived: boolean
}
