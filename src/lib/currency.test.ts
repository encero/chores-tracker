import { describe, expect, test } from 'vitest'
import {
  QUALITY_COEFFICIENTS,
  calculateReward,
  formatCurrency,
  parseToCents,
} from './currency'

describe('formatCurrency', () => {
  test('formats cents to dollars with default currency', () => {
    expect(formatCurrency(1234)).toBe('$12.34')
  })

  test('formats cents with custom currency symbol', () => {
    expect(formatCurrency(1234, 'Kč')).toBe('Kč12.34')
  })

  test('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  test('formats small amounts', () => {
    expect(formatCurrency(5)).toBe('$0.05')
  })

  test('formats large amounts', () => {
    expect(formatCurrency(100000)).toBe('$1000.00')
  })
})

describe('parseToCents', () => {
  test('parses number to cents', () => {
    expect(parseToCents(12.34)).toBe(1234)
  })

  test('parses string to cents', () => {
    expect(parseToCents('12.34')).toBe(1234)
  })

  test('parses string with currency symbol', () => {
    expect(parseToCents('$12.34')).toBe(1234)
    expect(parseToCents('Kč12.34')).toBe(1234)
  })

  test('rounds to nearest cent', () => {
    expect(parseToCents(12.345)).toBe(1235)
    expect(parseToCents(12.344)).toBe(1234)
  })

  test('handles zero', () => {
    expect(parseToCents(0)).toBe(0)
    expect(parseToCents('0')).toBe(0)
  })
})

describe('calculateReward', () => {
  const baseReward = 1000 // 10.00

  test('returns 0 for failed quality', () => {
    expect(calculateReward(baseReward, 'failed')).toBe(0)
  })

  test('returns 50% for bad quality', () => {
    expect(calculateReward(baseReward, 'bad')).toBe(500)
  })

  test('returns 100% for good quality', () => {
    expect(calculateReward(baseReward, 'good')).toBe(1000)
  })

  test('returns 125% for excellent quality', () => {
    expect(calculateReward(baseReward, 'excellent')).toBe(1250)
  })

  test('rounds result to nearest cent', () => {
    // 333 * 0.5 = 166.5, should round to 167
    expect(calculateReward(333, 'bad')).toBe(167)
  })
})

describe('QUALITY_COEFFICIENTS', () => {
  test('has correct values', () => {
    expect(QUALITY_COEFFICIENTS.failed).toBe(0)
    expect(QUALITY_COEFFICIENTS.bad).toBe(0.5)
    expect(QUALITY_COEFFICIENTS.good).toBe(1.0)
    expect(QUALITY_COEFFICIENTS.excellent).toBe(1.25)
  })
})
