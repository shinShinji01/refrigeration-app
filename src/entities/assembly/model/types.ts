import type { BaseRecord, IsoDateString } from '@/shared/api'

export type AssemblyId = string & { readonly __brand: 'AssemblyId' }

export interface Assembly extends BaseRecord {
  id: AssemblyId
  name: string
  drawingNumbers: string[]
  commissionedAt: IsoDateString | null
  introducedAtUnitNo: number | null
  isArchived: boolean
}
