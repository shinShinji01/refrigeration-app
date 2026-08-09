import { describe, expect, it } from 'vitest'
import {
  insulationFilterReducer,
  unitSelected,
  setSelected,
  unitNoSelected,
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
  unitNo: 47,
}

describe('insulationFilterSlice', () => {
  it('смена установки сбрасывает явный выбор версии и unitNo', () => {
    const state = insulationFilterReducer(filledState, unitSelected(UNIT_B))
    expect(state).toEqual({ unitId: UNIT_B, setId: null, unitNo: null })
  })

  it('выбор версии не трогает установку и unitNo', () => {
    const state = insulationFilterReducer(filledState, setSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, setId: null, unitNo: 47 })
  })

  it('unitNoSelected выставляет номер, не трогая установку и версию', () => {
    const state = insulationFilterReducer(filledState, unitNoSelected(48))
    expect(state).toEqual({ unitId: UNIT_A, setId: SET_A, unitNo: 48 })
  })

  it('unitNoSelected(null) сбрасывает явный выбор номера', () => {
    const state = insulationFilterReducer(filledState, unitNoSelected(null))
    expect(state).toEqual({ unitId: UNIT_A, setId: SET_A, unitNo: null })
  })
})
