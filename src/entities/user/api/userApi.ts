import { baseApi } from '@/shared/api'
import type { User } from '../model/types'

// Авторизации ещё нет — берём первого пользователя из БД (docs/data-model.md).
export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFirstUser: builder.query<User, void>({
      query: () => ({
        collection: 'users',
        method: 'getFirstListItem',
        filter: "id != ''",
      }),
      providesTags: ['User'],
    }),
  }),
})

export const { useGetFirstUserQuery } = userApi
