import { describe, expect, it, vi } from 'vitest'
import { collectDeletionDescendants } from './collectDeletionDescendants'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { AssemblyId } from '@/entities/assembly'
import type { PartId } from '@/entities/part'
import type { ComponentListItem } from '@/features/cascade-filter'
import type { RefrigerationUnit } from '@/entities/refrigeration-unit'
import type { Assembly } from '@/entities/assembly'
import type { Part } from '@/entities/part'

const UNIT_A = 'unit-a' as UnitId
const ASSEMBLY_A = 'assembly-a' as AssemblyId
const ASSEMBLY_B = 'assembly-b' as AssemblyId
const PART_A = 'part-a' as PartId
const PART_B = 'part-b' as PartId
const PART_C = 'part-c' as PartId

const unitItem = (id: UnitId): ComponentListItem => ({ kind: 'unit', unit: { id } as RefrigerationUnit })
const assemblyItem = (id: AssemblyId): ComponentListItem => ({ kind: 'assembly', assembly: { id } as Assembly })
const partItem = (id: PartId): ComponentListItem => ({ kind: 'part', part: { id } as Part })

describe('collectDeletionDescendants', () => {
  it('собирает узлы установки и детали каждого узла', async () => {
    const fetchAssembliesForUnit = vi.fn(async () => [{ id: ASSEMBLY_A }, { id: ASSEMBLY_B }])
    const fetchPartsForAssembly = vi.fn(async (assemblyId: AssemblyId) =>
      assemblyId === ASSEMBLY_A ? [{ id: PART_A }] : [{ id: PART_B }],
    )
    const fetchPartChildren = vi.fn(async () => [])

    const result = await collectDeletionDescendants([unitItem(UNIT_A)], {
      fetchAssembliesForUnit,
      fetchPartsForAssembly,
      fetchPartChildren,
    })

    expect(result.assemblyIds.sort()).toEqual([ASSEMBLY_A, ASSEMBLY_B].sort())
    expect(result.partIds.sort()).toEqual([PART_A, PART_B].sort())
  })

  it('рекурсивно спускается по part_parts (docs/decisions.md №9)', async () => {
    const fetchAssembliesForUnit = vi.fn(async () => [])
    const fetchPartsForAssembly = vi.fn(async () => [{ id: PART_A }])
    const fetchPartChildren = vi.fn(async (partId: PartId) => (partId === PART_A ? [{ id: PART_B }] : []))

    const result = await collectDeletionDescendants([assemblyItem(ASSEMBLY_A)], {
      fetchAssembliesForUnit,
      fetchPartsForAssembly,
      fetchPartChildren,
    })

    expect(result.partIds.sort()).toEqual([PART_A, PART_B].sort())
  })

  it('не дублирует и не зацикливается на общей детали', async () => {
    const fetchPartChildren = vi.fn(async (partId: PartId) => (partId === PART_A ? [{ id: PART_C }] : []))

    const result = await collectDeletionDescendants([partItem(PART_A), partItem(PART_A)], {
      fetchAssembliesForUnit: vi.fn(async () => []),
      fetchPartsForAssembly: vi.fn(async () => []),
      fetchPartChildren,
    })

    expect(result.partIds).toEqual([PART_C])
    expect(fetchPartChildren).toHaveBeenCalledTimes(3)
  })
})
