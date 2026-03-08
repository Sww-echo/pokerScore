import { normalizeRoomCode } from './roomForm'

export function buildRoomInviteLink(roomCode: string, origin = window.location.origin) {
  const normalizedCode = normalizeRoomCode(roomCode)

  if (!normalizedCode) {
    return origin
  }

  return `${origin.replace(/\/$/, '')}/room/${encodeURIComponent(normalizedCode)}`
}

export function extractRoomCodeFromInvitePayload(payload: string) {
  const rawPayload = payload.trim()

  if (!rawPayload) {
    return ''
  }

  const directCode = normalizeRoomCode(rawPayload)

  if (/^[A-Z0-9]{4,8}$/.test(directCode)) {
    return directCode
  }

  try {
    const inviteUrl = new URL(rawPayload)
    const pathSegments = inviteUrl.pathname.split('/').filter(Boolean)
    const roomIndex = pathSegments.findIndex((segment) => segment.toLowerCase() === 'room')

    if (roomIndex >= 0 && pathSegments[roomIndex + 1]) {
      const roomCode = normalizeRoomCode(decodeURIComponent(pathSegments[roomIndex + 1]))

      if (/^[A-Z0-9]{4,8}$/.test(roomCode)) {
        return roomCode
      }
    }

    const queryCode =
      inviteUrl.searchParams.get('roomCode') ?? inviteUrl.searchParams.get('code') ?? ''
    const normalizedQueryCode = normalizeRoomCode(queryCode)

    if (/^[A-Z0-9]{4,8}$/.test(normalizedQueryCode)) {
      return normalizedQueryCode
    }
  } catch {
    const pathMatch = rawPayload.match(/\/room\/([A-Za-z0-9]{4,8})/i)

    if (pathMatch?.[1]) {
      return normalizeRoomCode(pathMatch[1])
    }

    const queryMatch = rawPayload.match(/[?&](?:roomCode|code)=([A-Za-z0-9]{4,8})/i)

    if (queryMatch?.[1]) {
      return normalizeRoomCode(queryMatch[1])
    }
  }

  return ''
}
