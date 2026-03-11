export function formatTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value))
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

export function formatScore(value: number) {
  return value > 0 ? `+${value}` : `${value}`
}

export function shortCode(value: string) {
  return value.trim().toUpperCase()
}

export function formatIdentityKey(value?: string | null) {
  const normalized = value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() ?? ''

  if (!normalized) {
    return ''
  }

  const padded = normalized.padEnd(12, '0').slice(0, 12)

  return `PKR-${padded.slice(0, 4)}-${padded.slice(4, 8)}-${padded.slice(8, 12)}`
}
