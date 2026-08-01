import { pb } from '@/shared/api'
import type { User } from '../model/types'

export const getUserAvatarUrl = (user: User): string | null => {
  if (!user.avatar) {
    return null
  }
  return pb.files.getURL(user, user.avatar, { thumb: '100x100c' })
}
