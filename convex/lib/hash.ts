/**
 * Simple hash function for PIN storage
 * Uses SHA-256 - suitable for local network deployment
 * For production, consider using bcrypt or argon2
 */
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + '_chores_salt')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate a random session token
 */
export function generateSessionToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Generate a random access code for kids (4 digits)
 */
export function generateAccessCode(): string {
  const array = new Uint8Array(2)
  crypto.getRandomValues(array)
  const num = (array[0] << 8) | array[1]
  return String(num % 10000).padStart(4, '0')
}
