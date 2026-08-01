import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { UnitId } from '@/entities/refrigeration-unit'
import type { AssemblyId } from '@/entities/assembly'
import type { PartId } from '@/entities/part'

export interface CascadeFilterState {
  unitId: UnitId | null
  assemblyId: AssemblyId | null
  partId: PartId | null
}

const initialState: CascadeFilterState = {
  unitId: null,
  assemblyId: null,
  partId: null,
}

// Смена родителя сбрасывает выбор потомков в том же редьюсере — не размазано
// по обработчикам (docs/structure.md → "Каскадные дропдауны").
const cascadeFilterSlice = createSlice({
  name: 'cascadeFilter',
  initialState,
  reducers: {
    unitSelected: (state, action: PayloadAction<UnitId | null>) => {
      state.unitId = action.payload
      state.assemblyId = null
      state.partId = null
    },
    assemblySelected: (state, action: PayloadAction<AssemblyId | null>) => {
      state.assemblyId = action.payload
      state.partId = null
    },
    partSelected: (state, action: PayloadAction<PartId | null>) => {
      state.partId = action.payload
    },
  },
})

export const { unitSelected, assemblySelected, partSelected } = cascadeFilterSlice.actions
export const cascadeFilterReducer = cascadeFilterSlice.reducer
