import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

function normalizeBasePath(basePath?: string) {
  const trimmedBasePath = basePath?.trim() ?? ''

  if (!trimmedBasePath || trimmedBasePath === '/') {
    return '/'
  }

  const withLeadingSlash = trimmedBasePath.startsWith('/')
    ? trimmedBasePath
    : `/${trimmedBasePath}`

  return `${withLeadingSlash.replace(/\/+$/, '')}/`
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createProxyOptions(
  target: string,
  options: {
    stripPrefix?: string
    ws?: boolean
  } = {}
): ProxyOptions {
  const proxyOptions: ProxyOptions = {
    target,
    changeOrigin: true
  }

  if (options.ws) {
    proxyOptions.ws = true
  }

  if (options.stripPrefix) {
    const stripPrefixPattern = new RegExp(`^${escapeRegExp(options.stripPrefix)}`)
    proxyOptions.rewrite = (path) => path.replace(stripPrefixPattern, '')
  }

  return proxyOptions
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const appBasePath = normalizeBasePath(env.VITE_APP_BASE_PATH)
  const appBasePrefix = appBasePath === '/' ? '' : appBasePath.slice(0, -1)
  const backendTarget = 'http://localhost:3001'
  const proxy: Record<string, ProxyOptions> = {
    '/api/v1': createProxyOptions(backendTarget),
    '/socket.io': createProxyOptions(backendTarget, { ws: true })
  }

  if (appBasePrefix) {
    proxy[`${appBasePrefix}/api/v1`] = createProxyOptions(backendTarget, {
      stripPrefix: appBasePrefix
    })
    proxy[`${appBasePrefix}/socket.io`] = createProxyOptions(backendTarget, {
      stripPrefix: appBasePrefix,
      ws: true
    })
  }

  return {
    base: appBasePath,
    plugins: [vue()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy
    }
  }
})
