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
// linkId — id самой join-записи unit_assemblies (не assembly.id), нужен, чтобы
// точечно обновить количество или убрать связь, не трогая саму сущность узла.
export type AssemblyWithQuantity = Assembly & { quantity: number; linkId: string }
