import type { RoomMember, RoomState, SettlementSnapshot, TransferRecord, UserProfile } from '../types'
import { shortCode } from '../utils/format'
import { generateSettlementSuggestions } from '../utils/settlement'

function randomId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function createMockMember(
  nickname: string,
  seatLabel: string,
  accent: string
): RoomMember {
  return {
    id: randomId('member'),
    nickname,
    authMode: 'guest',
    accent,
    seatLabel,
    score: 0,
    isOnline: true,
    isCurrentUser: false
  }
}

function createInitialTransfers(roomCode: string, members: RoomMember[]): TransferRecord[] {
  const currentMember = members.find((member) => member.isCurrentUser)
  const zhou = members.find((member) => member.nickname === '老周')
  const kai = members.find((member) => member.nickname === '阿凯')
  const xiaoman = members.find((member) => member.nickname === '小满')
  const qiqi = members.find((member) => member.nickname === '七七')

  if (!currentMember || !zhou || !kai || !xiaoman || !qiqi) {
    return []
  }

  function atDayOffset(dayOffset: number, hours: number, minutes: number) {
    const date = new Date()
    date.setDate(date.getDate() - dayOffset)
    date.setHours(hours, minutes, 0, 0)
    date.setMilliseconds(0)
    return date.toISOString()
  }

  return [
    {
      id: randomId('transfer'),
      roomCode,
      fromMemberId: zhou.id,
      toMemberId: currentMember.id,
      score: 40,
      createdAt: atDayOffset(0, 14, 32)
    },
    {
      id: randomId('transfer'),
      roomCode,
      fromMemberId: currentMember.id,
      toMemberId: kai.id,
      score: 20,
      createdAt: atDayOffset(0, 14, 15)
    },
    {
      id: randomId('transfer'),
      roomCode,
      fromMemberId: qiqi.id,
      toMemberId: currentMember.id,
      score: 125,
      createdAt: atDayOffset(1, 23, 45)
    },
    {
      id: randomId('transfer'),
      roomCode,
      fromMemberId: currentMember.id,
      toMemberId: xiaoman.id,
      score: 5,
      createdAt: atDayOffset(1, 21, 10)
    }
  ]
}

function cloneMemberScores(members: RoomMember[]) {
  return members.map((member) => ({ ...member }))
}

export function recalculateRoomScores(roomState: RoomState) {
  const memberMap = new Map(roomState.members.map((member) => [member.id, member]))

  roomState.members.forEach((member) => {
    member.score = 0
  })

  roomState.transfers.forEach((transfer) => {
    if (transfer.score <= 0) {
      return
    }

    const fromMember = memberMap.get(transfer.fromMemberId)
    const toMember = memberMap.get(transfer.toMemberId)

    if (!fromMember || !toMember) {
      return
    }

    fromMember.score -= transfer.score
    toMember.score += transfer.score
  })
}

export function createSettlementSnapshot(
  roomState: RoomState,
  settledAt = new Date().toISOString()
): SettlementSnapshot {
  recalculateRoomScores(roomState)

  const ranking = cloneMemberScores(roomState.members).sort((left, right) => right.score - left.score)

  return {
    settledAt,
    ranking,
    suggestions: generateSettlementSuggestions(ranking)
  }
}

export function syncRoomDerivedState(roomState: RoomState) {
  recalculateRoomScores(roomState)

  if (roomState.status === 'active') {
    roomState.settlement = null
    return roomState
  }

  roomState.settlement = createSettlementSnapshot(
    roomState,
    roomState.settlement?.settledAt ?? roomState.updatedAt
  )

  return roomState
}

export function applyCurrentUserProfile(roomState: RoomState, profile: UserProfile) {
  const currentMember = roomState.members.find((member) => member.isCurrentUser)

  if (!currentMember) {
    return roomState
  }

  currentMember.nickname = profile.nickname
  currentMember.authMode = profile.authMode
  currentMember.accent = profile.accent

  return syncRoomDerivedState(roomState)
}

export function createLocalRoom(roomCode: string, roomName: string, profile: UserProfile): RoomState {
  const currentMember: RoomMember = {
    ...profile,
    seatLabel: '东位',
    score: 0,
    isOnline: true,
    isCurrentUser: true
  }

  const members: RoomMember[] = [
    currentMember,
    createMockMember('老周', '南位', 'amber'),
    createMockMember('阿凯', '西位', 'ocean'),
    createMockMember('小满', '北位', 'rose'),
    createMockMember('七七', '庄位', 'violet')
  ]

  const roomState: RoomState = {
    code: shortCode(roomCode),
    name: roomName.trim() || '今夜德州局',
    status: 'active',
    updatedAt: new Date().toISOString(),
    members,
    transfers: createInitialTransfers(shortCode(roomCode), members),
    settlement: null
  }

  return syncRoomDerivedState(roomState)
}

export function createLocalTransfer(roomCode: string, fromMemberId: string, toMemberId: string, score: number) {
  return {
    id: randomId('transfer'),
    roomCode,
    fromMemberId,
    toMemberId,
    score,
    createdAt: new Date().toISOString()
  }
}
