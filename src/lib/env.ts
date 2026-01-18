// Runtime environment configuration
// Server: reads from process.env
// Client: reads from window.__ENV__ (injected by server)

declare global {
  interface Window {
    __ENV__?: {
      CONVEX_URL: string
    }
  }
}

export function getEnv() {
  // Server-side: read from process.env
  if (typeof window === 'undefined') {
    return {
      CONVEX_URL: process.env.VITE_CONVEX_URL || '',
    }
  }

  // Client-side: read from injected env
  return {
    CONVEX_URL: window.__ENV__?.CONVEX_URL || '',
  }
}

export function getEnvScript() {
  // Generate script to inject env vars into client
  const env = {
    CONVEX_URL: process.env.VITE_CONVEX_URL || '',
  }
  return `window.__ENV__ = ${JSON.stringify(env)};`
}
