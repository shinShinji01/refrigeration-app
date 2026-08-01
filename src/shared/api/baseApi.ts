import { createApi } from '@reduxjs/toolkit/query/react'
import { pocketbaseBaseQuery } from './baseQuery'
import { TAG_TYPES } from './tags'

// Пустые endpoints — каждый entities/*/api инжектит свои через
// baseApi.injectEndpoints(). Здесь только общая инфраструктура.
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: pocketbaseBaseQuery,
  tagTypes: TAG_TYPES,
  endpoints: () => ({}),
})
