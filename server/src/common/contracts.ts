export type AuthMode = 'guest' | 'wechat'
export type RoomStatus = 'active' | 'settled'

export interface ApiSuccessResponse<T> {
  code: 0
  message: 'ok'
  data: T
}

export interface AuthUserView {
  id: string
  nickname: string
  authMode: AuthMode
  accent: string
  avatarUrl: string | null
}

export interface RoomMemberView {
  id: string
  nickname: string
  authMode: AuthMode
  accent: string
  avatarUrl: string | null
  seatLabel: string
  score: number
  isOnline: boolean
  isCurrentUser: boolean
}

export interface TransferRecordView {
  id: string
  roomCode: string
  fromMemberId: string
  toMemberId: string
  score: number
  createdAt: string
}

export interface SettlementSuggestionView {
  fromMemberId: string
  toMemberId: string
  amount: number
}

export interface SettlementSnapshotView {
  settledAt: string
  ranking: RoomMemberView[]
  suggestions: SettlementSuggestionView[]
}

export interface RoomSnapshotView {
  code: string
  name: string
  status: RoomStatus
  updatedAt: string
  version: number
  roundNo: number
  currentUserMemberId: string | null
  members: RoomMemberView[]
  transfers: TransferRecordView[]
  settlement: SettlementSnapshotView | null
}

export function ok<T>(data: T): ApiSuccessResponse<T> {
  return {
    code: 0,
    message: 'ok',
    data
  }
}
