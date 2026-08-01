import type { BaseRecord } from '@/shared/api'

export type UserId = string & { readonly __brand: 'UserId' }

// Штатная auth-коллекция PocketBase. Авторизации ещё нет — берём первого
// пользователя. См. docs/data-model.md → "users".
export interface User extends BaseRecord {
  id: UserId
  email: string
  name: string
  avatar: string
}
