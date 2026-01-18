/**
 * Format cents to a currency string
 * @param cents - Amount in cents
 * @param currency - Currency symbol (default: "$")
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, currency: string = '$'): string {
  const dollars = cents / 100
  return `${currency}${dollars.toFixed(2)}`
}

/**
 * Parse a currency string to cents
 * @param value - Currency string or number
 * @returns Amount in cents
 */
export function parseToCents(value: string | number): number {
  if (typeof value === 'number') {
    return Math.round(value * 100)
  }
  // Remove currency symbols and parse
  const cleaned = value.replace(/[^0-9.-]/g, '')
  const dollars = parseFloat(cleaned)
  return Math.round(dollars * 100)
}

/**
 * Quality coefficients for reward calculation
 */
export const QUALITY_COEFFICIENTS = {
  bad: 0.5,
  good: 1.0,
  excellent: 1.25,
} as const

export type QualityRating = keyof typeof QUALITY_COEFFICIENTS

/**
 * Calculate earned reward based on quality
 * @param baseReward - Base reward in cents
 * @param quality - Quality rating
 * @returns Earned reward in cents
 */
export function calculateReward(baseReward: number, quality: QualityRating): number {
  return Math.round(baseReward * QUALITY_COEFFICIENTS[quality])
}
