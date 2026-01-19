import { formatCurrency, formatCurrencyWithSign } from '@/lib/currency'
import { cn } from '@/lib/utils'

export interface MoneyProps {
  /** Amount in cents */
  cents: number
  /** Currency symbol (e.g., "$", "Kč") */
  currency?: string
  /** Show sign prefix (+ for positive, - for negative) */
  showSign?: boolean
  /** Color based on value (green for positive, red for negative) */
  colorize?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * Money component for displaying currency amounts with proper formatting.
 * Handles currency symbol placement (prefix for $, suffix for Kč) and
 * optional sign display with color coding.
 */
export function Money({
  cents,
  currency = '$',
  showSign = false,
  colorize = false,
  className,
}: MoneyProps) {
  const formatted = showSign
    ? formatCurrencyWithSign(cents, currency, true)
    : formatCurrency(cents, currency)

  const colorClass = colorize
    ? cents > 0
      ? 'text-green-600'
      : cents < 0
        ? 'text-red-600'
        : ''
    : ''

  return <span className={cn(colorClass, className)}>{formatted}</span>
}
