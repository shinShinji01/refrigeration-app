import { describe, expect, it } from 'vitest'
import { summarizeByGroup } from './summarizeByGroup'
import type { InsulationGroupId } from '@/entities/insulation-group'

const GROUP_A = 'group-a' as InsulationGroupId
const GROUP_B = 'group-b' as InsulationGroupId

describe('summarizeByGroup', () => {
  it('суммирует площадь с учётом количества и переводит в м²', () => {
    // 1 000 000 мм² × 2 = 2 000 000 мм² = 2 м²
    const result = summarizeByGroup([{ groupId: GROUP_A, areaMm2: 1_000_000, quantity: 2 }])
    expect(result).toEqual([{ groupId: GROUP_A, areaM2: 2 }])
  })

  it('группирует по группе, куски разных групп не смешиваются', () => {
    const result = summarizeByGroup([
      { groupId: GROUP_A, areaMm2: 500_000, quantity: 1 },
      { groupId: GROUP_B, areaMm2: 500_000, quantity: 1 },
      { groupId: GROUP_A, areaMm2: 500_000, quantity: 1 },
    ])
    expect(result).toEqual([
      { groupId: GROUP_A, areaM2: 1 },
      { groupId: GROUP_B, areaM2: 0.5 },
    ])
  })

  it('пустой список — пустой результат', () => {
    expect(summarizeByGroup([])).toEqual([])
  })
})
