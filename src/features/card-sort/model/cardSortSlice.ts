import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export type SortBy = 'name' | 'type' | 'date'

export interface CardSortState {
  sortBy: SortBy
}

const initialState: CardSortState = {
  sortBy: 'name',
}

const cardSortSlice = createSlice({
  name: 'cardSort',
  initialState,
  reducers: {
    sortByChanged: (state, action: PayloadAction<SortBy>) => {
      state.sortBy = action.payload
    },
  },
})

export const { sortByChanged } = cardSortSlice.actions
export const cardSortReducer = cardSortSlice.reducer
