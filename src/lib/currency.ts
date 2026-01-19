/**
 * Currencies that use suffix notation (symbol after the number)
 */
const SUFFIX_CURRENCIES = new Set(['Kč', 'CZK', '€', 'EUR', 'kr', 'SEK', 'NOK', 'DKK', 'zł', 'PLN', 'Ft', 'HUF'])

/**
 * Check if a currency symbol should be displayed as suffix
 */
export function isSuffixCurrency(currency: string): boolean {
  return SUFFIX_CURRENCIES.has(currency)
}

/**
 * Format cents to a currency string
 * @param cents - Amount in cents
 * @param currency - Currency symbol (default: "$")
 * @returns Formatted currency string
 */
export function formatCurrency(cents: number, currency: string = '$'): string {
  const value = cents / 100
  const formattedValue = value.toFixed(2)

  if (isSuffixCurrency(currency)) {
    return `${formattedValue} ${currency}`
  }
  return `${currency}${formattedValue}`
}

/**
 * Format cents to a currency string with sign prefix
 * @param cents - Amount in cents (can be negative)
 * @param currency - Currency symbol (default: "$")
 * @param showPositiveSign - Whether to show + sign for positive amounts
 * @returns Formatted currency string with sign
 */
export function formatCurrencyWithSign(
  cents: number,
  currency: string = '$',
  showPositiveSign: boolean = false
): string {
  const absValue = Math.abs(cents) / 100
  const formattedValue = absValue.toFixed(2)
  const sign = cents < 0 ? '-' : (showPositiveSign ? '+' : '')

  if (isSuffixCurrency(currency)) {
    return `${sign}${formattedValue} ${currency}`
  }
  return `${sign}${currency}${formattedValue}`
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
  failed: 0,
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
