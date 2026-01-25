import { describe, expect, test } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  test('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  test('handles falsy values', () => {
    expect(cn('foo', false, 'baz')).toBe('foo baz')
    expect(cn('foo', '', 'baz')).toBe('foo baz')
  })

  test('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  test('merges tailwind classes correctly', () => {
    // Later class should override earlier conflicting class
    expect(cn('p-4', 'p-2')).toBe('p-2')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  test('preserves non-conflicting tailwind classes', () => {
    expect(cn('p-4', 'm-2')).toBe('p-4 m-2')
  })

  test('handles arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  test('handles objects', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  test('handles complex combinations', () => {
    expect(cn('base', ['array-class'], { 'object-class': true })).toBe(
      'base array-class object-class'
    )
  })
})
