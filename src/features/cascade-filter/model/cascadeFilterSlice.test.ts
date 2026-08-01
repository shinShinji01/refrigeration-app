import { describe, expect, it } from 'vitest'
import {
  cascadeFilterReducer,
  unitSelected,
  assemblySelected,
  partSelected,
  type CascadeFilterState,
} from './cascadeFilterSlice'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { AssemblyId } from '@/entities/assembly'
import type { PartId } from '@/entities/part'

const UNIT_A = 'unit-a' as UnitId
const UNIT_B = 'unit-b' as UnitId
const ASSEMBLY_A = 'assembly-a' as AssemblyId
const PART_A = 'part-a' as PartId

const filledState: CascadeFilterState = {
  unitId: UNIT_A,
  assemblyId: ASSEMBLY_A,
  partId: PART_A,
}

describe('cascadeFilterSlice', () => {
  it('смена установки сбрасывает выбранный узел и деталь', () => {
    const state = cascadeFilterReducer(filledState, unitSelected(UNIT_B))
    expect(state).toEqual({ unitId: UNIT_B, assemblyId: null, partId: null })
  })

  it('смена узла сбрасывает выбранную деталь, установка не трогается', () => {
    const state = cascadeFilterReducer(filledState, assemblySelected(null))
    expect(state).toEqual({ unitId: UNIT_A, assemblyId: null, partId: null })
  })

  it('выбор детали не трогает установку и узел', () => {
    const state = cascadeFilterReducer(filledState, partSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, assemblyId: ASSEMBLY_A, partId: null })
  })
})
