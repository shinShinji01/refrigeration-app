import { configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@/shared/api'
import { cascadeFilterReducer } from '@/features/cascade-filter'

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    cascadeFilter: cascadeFilterReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
