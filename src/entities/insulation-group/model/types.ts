import type { BaseRecord, IsoDateString } from '@/shared/api'

export type InsulationGroupId = string & { readonly __brand: 'InsulationGroupId' }

// Группа не привязана к установке напрямую — переиспользуема между наборами
// через join set_groups. См. docs/data-model.md.
export interface InsulationGroup extends BaseRecord {
  id: InsulationGroupId
  name: string
  commissionedAt: IsoDateString | null
  introducedAtUnitNo: number | null
  isArchived: boolean
}

// Группа в составе конкретного набора (set_groups) — с количеством и порядком
// показа. linkId — id самой join-записи (см. AssemblyWithQuantity), нужен как
// стабильный ключ и для будущих мутаций состава набора.
export type InsulationGroupWithQuantity = InsulationGroup & {
  quantity: number
  order: number
  linkId: string
}
