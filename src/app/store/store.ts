import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@/shared/api'
import { cascadeFilterReducer } from '@/features/cascade-filter'
import { cardSelectionReducer } from '@/features/card-selection'
import { cardSortReducer } from '@/features/card-sort'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    cascadeFilter: cascadeFilterReducer,
    cardSelection: cardSelectionReducer,
    cardSort: cardSortReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
