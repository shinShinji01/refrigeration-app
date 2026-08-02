import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

export interface CardSelectionState {
  // Ключи карточек (см. getComponentListItemKey), не сами сущности — состав
  // видимого списка приходит из RTK Query, дублировать его в слайсе не нужно.
  selectedKeys: string[]
}

const initialState: CardSelectionState = {
  selectedKeys: [],
}

const cardSelectionSlice = createSlice({
  name: 'cardSelection',
  initialState,
  reducers: {
    selectionToggled: (state, action: PayloadAction<string>) => {
      const index = state.selectedKeys.indexOf(action.payload)
      if (index === -1) {
        state.selectedKeys.push(action.payload)
      } else {
        state.selectedKeys.splice(index, 1)
      }
    },
    selectionCleared: (state) => {
      state.selectedKeys = []
    },
  },
})

export const { selectionToggled, selectionCleared } = cardSelectionSlice.actions
export const cardSelectionReducer = cardSelectionSlice.reducer
