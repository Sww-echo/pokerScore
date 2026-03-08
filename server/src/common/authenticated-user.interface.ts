import type { AuthMode } from './contracts'

export interface AuthenticatedUser {
  userId: string
  nickname: string
  authMode: AuthMode
  accent: string
  avatarUrl: string | null
  deviceId?: string
}
