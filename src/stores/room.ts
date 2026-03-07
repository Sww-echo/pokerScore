import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  AuthMode,
  RoomMember,
  RoomState,
  SettlementSnapshot,
  TransferDraft,
  TransferMode,
  TransferRecord,
  UserProfile
} from '../types'
import { shortCode } from '../utils/format'
import { generateSettlementSuggestions } from '../utils/settlement'

const STORAGE_KEY = 'poker-score-room-state-v1'

interface PersistedState {
  profile: UserProfile | null
  room: RoomState | null
}

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

function createProfile(nickname: string, authMode: AuthMode): UserProfile {
  return {
    id: randomId('user'),
    nickname: nickname.trim() || `牌友${Math.floor(Math.random() * 900 + 100)}`,
    authMode,
    accent: authMode === 'wechat' ? 'jade' : 'sunset'
  }
}

function buildInitialRoom(roomCode: string, roomName: string, profile: UserProfile): RoomState {
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

  recalculateRoomScores(roomState)

  return roomState
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

function normalizeMemberScores(members: RoomMember[]) {
  return members.map((member) => ({ ...member }))
}

function recalculateRoomScores(roomState: RoomState) {
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

function saveState(payload: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
}

function loadState(): PersistedState | null {
  const raw = window.localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as PersistedState
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return null
  }
}

export const useRoomStore = defineStore('room', () => {
  const profile = ref<UserProfile | null>(null)
  const room = ref<RoomState | null>(null)

  function persist() {
    saveState({
      profile: profile.value,
      room: room.value
    })
  }

  function hydrate() {
    const persisted = loadState()

    if (!persisted) {
      return
    }

    profile.value = persisted.profile
    room.value = persisted.room

    if (!room.value) {
      return
    }

    recalculateRoomScores(room.value)

    if (room.value.status === 'active') {
      room.value.settlement = null
      return
    }

    const ranking = normalizeMemberScores(room.value.members).sort((left, right) => right.score - left.score)
    room.value.settlement = {
      settledAt: room.value.settlement?.settledAt ?? room.value.updatedAt,
      ranking,
      suggestions: generateSettlementSuggestions(ranking)
    }
  }

  function ensureProfile(nickname: string, authMode: AuthMode) {
    if (profile.value && profile.value.nickname === nickname.trim() && profile.value.authMode === authMode) {
      return profile.value
    }

    profile.value = createProfile(nickname, authMode)
    persist()
    return profile.value
  }

  function createRoom(payload: { nickname: string; authMode: AuthMode; roomName: string }) {
    const nextProfile = ensureProfile(payload.nickname, payload.authMode)
    const roomCode = Math.floor(Math.random() * 900000 + 100000).toString()

    room.value = buildInitialRoom(roomCode, payload.roomName, nextProfile)
    persist()

    return roomCode
  }

  function joinRoom(payload: { nickname: string; authMode: AuthMode; roomCode: string }) {
    const nextProfile = ensureProfile(payload.nickname, payload.authMode)
    const normalizedCode = shortCode(payload.roomCode)

    if (room.value?.code === normalizedCode) {
      const member = room.value.members.find((item) => item.isCurrentUser)

      if (member) {
        member.nickname = nextProfile.nickname
        member.authMode = nextProfile.authMode
        member.accent = nextProfile.accent
      }

      persist()
      return normalizedCode
    }

    room.value = buildInitialRoom(normalizedCode, `牌局 ${normalizedCode}`, nextProfile)
    persist()

    return normalizedCode
  }

  function getMemberById(memberId: string) {
    return room.value?.members.find((member) => member.id === memberId) ?? null
  }

  function transferScores(drafts: TransferDraft[], _mode: TransferMode) {
    if (!room.value || room.value.status === 'settled') {
      return false
    }

    const sender = room.value.members.find((member) => member.isCurrentUser)

    if (!sender) {
      return false
    }

    const validDrafts = drafts.filter((draft) => draft.score > 0 && draft.toMemberId !== sender.id)

    if (validDrafts.length === 0) {
      return false
    }

    validDrafts.forEach((draft) => {
      const receiver = getMemberById(draft.toMemberId)

      if (!receiver) {
        return
      }

      sender.score -= draft.score
      receiver.score += draft.score

      room.value?.transfers.unshift({
        id: randomId('transfer'),
        roomCode: room.value.code,
        fromMemberId: sender.id,
        toMemberId: receiver.id,
        score: draft.score,
        createdAt: new Date().toISOString()
      })
    })

    recalculateRoomScores(room.value)
    room.value.updatedAt = new Date().toISOString()
    room.value.status = 'active'
    room.value.settlement = null

    persist()
    return true
  }

  function settleRoom() {
    if (!room.value) {
      return null
    }

    if (room.value.status === 'settled' && room.value.settlement) {
      return room.value.settlement
    }

    recalculateRoomScores(room.value)

    const ranking = normalizeMemberScores(room.value.members).sort((left, right) => right.score - left.score)
    const snapshot: SettlementSnapshot = {
      settledAt: new Date().toISOString(),
      ranking,
      suggestions: generateSettlementSuggestions(ranking)
    }

    room.value.status = 'settled'
    room.value.settlement = snapshot
    room.value.updatedAt = snapshot.settledAt
    persist()

    return snapshot
  }

  function reopenRoom() {
    if (!room.value) {
      return
    }

    room.value.status = 'active'
    room.value.settlement = null
    room.value.updatedAt = new Date().toISOString()
    persist()
  }

  const currentUser = computed(() => room.value?.members.find((member) => member.isCurrentUser) ?? null)
  const ranking = computed(() =>
    room.value ? [...room.value.members].sort((left, right) => right.score - left.score) : []
  )
  const totalTransfers = computed(() => room.value?.transfers.length ?? 0)

  return {
    profile,
    room,
    currentUser,
    ranking,
    totalTransfers,
    hydrate,
    ensureProfile,
    createRoom,
    joinRoom,
    transferScores,
    settleRoom,
    reopenRoom,
    getMemberById
  }
})
