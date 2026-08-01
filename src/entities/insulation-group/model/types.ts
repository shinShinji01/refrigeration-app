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
