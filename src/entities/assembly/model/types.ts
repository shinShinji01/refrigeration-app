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

// Узел в составе конкретной установки (unit_assemblies) — с количеством на установку.
export type AssemblyWithQuantity = Assembly & { quantity: number }
