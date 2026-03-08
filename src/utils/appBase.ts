const ABSOLUTE_URL_PATTERN = /^[a-z]+:\/\//i

function normalizeSlashPrefixedPath(value: string) {
  if (!value || value === '/') {
    return '/'
  }

  return `/${value.replace(/^\/+/, '').replace(/\/+$/, '')}`
}

export function normalizeBasePath(basePath?: string) {
  const trimmedBasePath = basePath?.trim() ?? ''

  if (!trimmedBasePath || trimmedBasePath === '/') {
    return '/'
  }

  return `${normalizeSlashPrefixedPath(trimmedBasePath)}/`
}

export function getAppBasePath() {
  return normalizeBasePath(import.meta.env.VITE_APP_BASE_PATH || import.meta.env.BASE_URL)
}

export function getAppBasePrefix() {
  const appBasePath = getAppBasePath()

  return appBasePath === '/' ? '' : appBasePath.replace(/\/$/, '')
}

export function buildAppPath(path = '') {
  const appBasePath = getAppBasePath()
  const appBasePrefix = getAppBasePrefix()
  const trimmedPath = path.trim().replace(/^\/+/, '')

  if (!trimmedPath) {
    return appBasePath
  }

  return `${appBasePrefix}/${trimmedPath}`
}

export function buildAppUrl(path = '', origin = window.location.origin) {
  const normalizedOrigin = origin.replace(/\/$/, '')
  const appPath = buildAppPath(path)

  return appPath === '/' ? `${normalizedOrigin}/` : `${normalizedOrigin}${appPath}`
}

export function normalizeUrlOrPath(value: string | undefined, fallbackValue: string) {
  const trimmedValue = value?.trim()

  if (!trimmedValue) {
    return fallbackValue
  }

  if (ABSOLUTE_URL_PATTERN.test(trimmedValue) || trimmedValue.startsWith('//')) {
    return trimmedValue.replace(/\/+$/, '')
  }

  return normalizeSlashPrefixedPath(trimmedValue)
}
