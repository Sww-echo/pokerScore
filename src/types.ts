export type AuthMode = 'guest' | 'wechat'
export type RoomStatus = 'active' | 'settled'
export type TransferMode = 'single' | 'multi'

export interface UserProfile {
  id: string
  nickname: string
  authMode: AuthMode
  accent: string
}

export interface RoomMember extends UserProfile {
  seatLabel: string
  score: number
  isOnline: boolean
  isCurrentUser: boolean
}

export interface TransferRecord {
  id: string
  roomCode: string
  fromMemberId: string
  toMemberId: string
  score: number
  createdAt: string
}

export interface SettlementSuggestion {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export interface SettlementSnapshot {
  settledAt: string
  ranking: RoomMember[]
  suggestions: SettlementSuggestion[]
}

export interface RoomState {
  code: string
  name: string
  status: RoomStatus
  updatedAt: string
  members: RoomMember[]
  transfers: TransferRecord[]
  settlement: SettlementSnapshot | null
}

export interface TransferDraft {
  toMemberId: string
  score: number
}
