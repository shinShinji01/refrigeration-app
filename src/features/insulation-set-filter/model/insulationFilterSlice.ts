import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { InsulationSetId } from '@/entities/insulation-set'

export interface InsulationFilterState {
  unitId: UnitId | null
  // null — версия не выбрана явно, действует авто-выбор самой актуальной
  // (pickCurrentSet). Не то же самое, что "нет наборов вообще".
  setId: InsulationSetId | null
  // null — номер не выбран явно, действует автовычисление
  // (lastCompletedUnitNoInsulation + 1) в useInsulationSetFilter.
  unitNo: number | null
}

const initialState: InsulationFilterState = {
  unitId: null,
  setId: null,
  unitNo: null,
}

// Смена установки сбрасывает явный выбор версии — снова действует авто-выбор
// самой актуальной для новой установки (docs/spec.md → "По-умолчанию при
// выборе установки ставится самая актуальная") — и явный выбор unitNo, т.к.
// это про физический экземпляр КОНКРЕТНОЙ установки, не переносится на другую.
const insulationFilterSlice = createSlice({
  name: 'insulationFilter',
  initialState,
  reducers: {
    unitSelected: (state, action: PayloadAction<UnitId | null>) => {
      state.unitId = action.payload
      state.setId = null
      state.unitNo = null
    },
    setSelected: (state, action: PayloadAction<InsulationSetId | null>) => {
      state.setId = action.payload
    },
    // Смена версии набора НЕ сбрасывает unitNo — версия и физический номер
    // независимы (тот же принцип, что "состав установки и набор изоляции
    // независимы", docs/data-model.md).
    unitNoSelected: (state, action: PayloadAction<number | null>) => {
      state.unitNo = action.payload
    },
  },
})

export const { unitSelected, setSelected, unitNoSelected } = insulationFilterSlice.actions
export const insulationFilterReducer = insulationFilterSlice.reducer
