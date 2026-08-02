import { describe, expect, it } from 'vitest'
import {
  insulationFilterReducer,
  unitSelected,
  setSelected,
  type InsulationFilterState,
} from './insulationFilterSlice'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'

const UNIT_A = 'unit-a' as UnitId
const UNIT_B = 'unit-b' as UnitId
const SET_A = 'set-a' as InsulationSetId

const filledState: InsulationFilterState = {
  unitId: UNIT_A,
  setId: SET_A,
}

describe('insulationFilterSlice', () => {
  it('смена установки сбрасывает явный выбор версии', () => {
    const state = insulationFilterReducer(filledState, unitSelected(UNIT_B))
    expect(state).toEqual({ unitId: UNIT_B, setId: null })
  })

  it('выбор версии не трогает установку', () => {
    const state = insulationFilterReducer(filledState, setSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, setId: null })
  })
})
