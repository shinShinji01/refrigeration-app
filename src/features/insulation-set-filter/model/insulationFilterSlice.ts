import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'

export interface InsulationFilterState {
  unitId: UnitId | null
  // null — версия не выбрана явно, действует авто-выбор самой актуальной
  // (pickCurrentSet). Не то же самое, что "нет наборов вообще".
  setId: InsulationSetId | null
}

const initialState: InsulationFilterState = {
  unitId: null,
  setId: null,
}

// Смена установки сбрасывает явный выбор версии — снова действует авто-выбор
// самой актуальной для новой установки (docs/spec.md → "По-умолчанию при
// выборе установки ставится самая актуальная").
const insulationFilterSlice = createSlice({
  name: 'insulationFilter',
  initialState,
  reducers: {
    unitSelected: (state, action: PayloadAction<UnitId | null>) => {
      state.unitId = action.payload
      state.setId = null
    },
    setSelected: (state, action: PayloadAction<InsulationSetId | null>) => {
      state.setId = action.payload
    },
  },
})

export const { unitSelected, setSelected } = insulationFilterSlice.actions
export const insulationFilterReducer = insulationFilterSlice.reducer
