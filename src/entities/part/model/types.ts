import type { BaseRecord, IsoDateString } from '@/shared/api'

export type PartId = string & { readonly __brand: 'PartId' }

// Деталь может рекурсивно состоять из других деталей (part_parts) — это не
// отдельный уровень иерархии, а join той же коллекции. См. docs/decisions.md №9.
export interface Part extends BaseRecord {
  id: PartId
  name: string
  drawingNumbers: string[]
  commissionedAt: IsoDateString | null
  isArchived: boolean
}

// Деталь в составе конкретного узла (assembly_parts) или родительской детали
// (part_parts) — с количеством на узел/родителя.
export type PartWithQuantity = Part & { quantity: number }
