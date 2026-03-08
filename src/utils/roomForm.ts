import { shortCode } from './format'

export function generateDefaultNickname() {
  return `牌友${Math.floor(Math.random() * 900 + 100)}`
}

export function normalizeNickname(value: string) {
  return value.trim() || generateDefaultNickname()
}

export function normalizeRoomName(value: string, fallbackNickname?: string) {
  const nextName = value.trim()

  if (nextName) {
    return nextName
  }

  return fallbackNickname ? `${fallbackNickname}的牌局` : '新牌局'
}

export function normalizeRoomCode(value: string) {
  return shortCode(value).replace(/\s+/g, '')
}

export function validateRoomCode(value: string) {
  const normalizedCode = normalizeRoomCode(value)

  if (!normalizedCode) {
    return '请输入房间号'
  }

  if (normalizedCode.length < 4 || normalizedCode.length > 8) {
    return '房间号长度需为 4 到 8 位'
  }

  if (!/^[A-Z0-9]+$/.test(normalizedCode)) {
    return '房间号仅支持字母和数字'
  }

  return ''
}
