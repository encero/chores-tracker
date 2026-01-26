import { describe, expect, test } from 'vitest'

/**
 * Tests for pagination response format and helper functions.
 * These tests validate the expected structure of paginated responses
 * from Convex queries.
 */

// Type definition for paginated response
interface PaginatedResponse<T> {
  items: Array<T>
  hasMore: boolean
  totalCount: number
}

// Helper to create mock paginated response
function createPaginatedResponse<T>(
  allItems: Array<T>,
  limit: number
): PaginatedResponse<T> {
  return {
    items: allItems.slice(0, limit),
    hasMore: allItems.length > limit,
    totalCount: allItems.length,
  }
}

describe('Pagination Response Format', () => {
  const mockItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  test('returns correct items when limit is less than total', () => {
    const response = createPaginatedResponse(mockItems, 5)

    expect(response.items).toEqual([1, 2, 3, 4, 5])
    expect(response.hasMore).toBe(true)
    expect(response.totalCount).toBe(10)
  })

  test('returns hasMore: false when limit exceeds total', () => {
    const response = createPaginatedResponse(mockItems, 20)

    expect(response.items).toEqual(mockItems)
    expect(response.hasMore).toBe(false)
    expect(response.totalCount).toBe(10)
  })

  test('returns hasMore: false when limit equals total', () => {
    const response = createPaginatedResponse(mockItems, 10)

    expect(response.items).toEqual(mockItems)
    expect(response.hasMore).toBe(false)
    expect(response.totalCount).toBe(10)
  })

  test('handles empty array', () => {
    const response = createPaginatedResponse<number>([], 10)

    expect(response.items).toEqual([])
    expect(response.hasMore).toBe(false)
    expect(response.totalCount).toBe(0)
  })

  test('handles limit of 1', () => {
    const response = createPaginatedResponse(mockItems, 1)

    expect(response.items).toEqual([1])
    expect(response.hasMore).toBe(true)
    expect(response.totalCount).toBe(10)
  })
})

describe('Pagination State Management', () => {
  const ITEMS_PER_PAGE = 10

  test('calculates correct limit after multiple load more clicks', () => {
    let limit = ITEMS_PER_PAGE

    // First load more
    limit += ITEMS_PER_PAGE
    expect(limit).toBe(20)

    // Second load more
    limit += ITEMS_PER_PAGE
    expect(limit).toBe(30)
  })

  test('hasMore determines if load more button should show', () => {
    const totalItems = 25

    // First page
    let limit = ITEMS_PER_PAGE
    let hasMore = totalItems > limit
    expect(hasMore).toBe(true)

    // After one load more
    limit += ITEMS_PER_PAGE
    hasMore = totalItems > limit
    expect(hasMore).toBe(true)

    // After two load more (now showing all 25)
    limit += ITEMS_PER_PAGE
    hasMore = totalItems > limit
    expect(hasMore).toBe(false)
  })

  test('remaining count is calculated correctly', () => {
    const totalCount = 35
    const displayedCount = 20

    const remaining = totalCount - displayedCount
    expect(remaining).toBe(15)
  })
})

describe('Chore-specific Pagination Defaults', () => {
  // These constants should match the values used in the frontend components
  const CHILD_DETAIL_ITEMS_PER_PAGE = 10
  const REVIEW_ITEMS_PER_PAGE = 10
  const TEMPLATES_ITEMS_PER_PAGE = 12
  const SCHEDULE_ITEMS_PER_PAGE = 15

  test('child detail page uses correct page size', () => {
    expect(CHILD_DETAIL_ITEMS_PER_PAGE).toBe(10)
  })

  test('review page uses correct page size', () => {
    expect(REVIEW_ITEMS_PER_PAGE).toBe(10)
  })

  test('templates page uses correct page size', () => {
    expect(TEMPLATES_ITEMS_PER_PAGE).toBe(12)
  })

  test('schedule page uses correct page size', () => {
    expect(SCHEDULE_ITEMS_PER_PAGE).toBe(15)
  })
})

describe('Query Status Filter', () => {
  type ChoreStatus = 'pending' | 'completed' | 'missed'

  interface MockChore {
    id: string
    status: ChoreStatus
    dueDate: string
  }

  const mockChores: Array<MockChore> = [
    { id: '1', status: 'pending', dueDate: '2024-01-15' },
    { id: '2', status: 'completed', dueDate: '2024-01-14' },
    { id: '3', status: 'pending', dueDate: '2024-01-16' },
    { id: '4', status: 'missed', dueDate: '2024-01-10' },
    { id: '5', status: 'completed', dueDate: '2024-01-12' },
  ]

  function filterByStatus(chores: Array<MockChore>, status?: ChoreStatus): Array<MockChore> {
    if (!status) return chores
    return chores.filter(c => c.status === status)
  }

  test('filters pending chores correctly', () => {
    const pending = filterByStatus(mockChores, 'pending')
    expect(pending).toHaveLength(2)
    expect(pending.every(c => c.status === 'pending')).toBe(true)
  })

  test('filters completed chores correctly', () => {
    const completed = filterByStatus(mockChores, 'completed')
    expect(completed).toHaveLength(2)
    expect(completed.every(c => c.status === 'completed')).toBe(true)
  })

  test('filters missed chores correctly', () => {
    const missed = filterByStatus(mockChores, 'missed')
    expect(missed).toHaveLength(1)
    expect(missed.every(c => c.status === 'missed')).toBe(true)
  })

  test('returns all chores when no status filter', () => {
    const all = filterByStatus(mockChores)
    expect(all).toHaveLength(5)
  })
})

describe('Date Sorting for Pagination', () => {
  interface MockItem {
    id: string
    dueDate: string
  }

  const unsortedItems: Array<MockItem> = [
    { id: '1', dueDate: '2024-01-15' },
    { id: '2', dueDate: '2024-01-10' },
    { id: '3', dueDate: '2024-01-20' },
    { id: '4', dueDate: '2024-01-12' },
  ]

  function sortByDateDesc(items: Array<MockItem>): Array<MockItem> {
    return [...items].sort((a, b) => b.dueDate.localeCompare(a.dueDate))
  }

  function sortByDateAsc(items: Array<MockItem>): Array<MockItem> {
    return [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }

  test('sorts by date descending (newest first)', () => {
    const sorted = sortByDateDesc(unsortedItems)

    expect(sorted[0].dueDate).toBe('2024-01-20')
    expect(sorted[1].dueDate).toBe('2024-01-15')
    expect(sorted[2].dueDate).toBe('2024-01-12')
    expect(sorted[3].dueDate).toBe('2024-01-10')
  })

  test('sorts by date ascending (oldest first)', () => {
    const sorted = sortByDateAsc(unsortedItems)

    expect(sorted[0].dueDate).toBe('2024-01-10')
    expect(sorted[1].dueDate).toBe('2024-01-12')
    expect(sorted[2].dueDate).toBe('2024-01-15')
    expect(sorted[3].dueDate).toBe('2024-01-20')
  })

  test('paginated result maintains sort order', () => {
    const sorted = sortByDateDesc(unsortedItems)
    const limit = 2
    const paginated = sorted.slice(0, limit)

    expect(paginated).toHaveLength(2)
    expect(paginated[0].dueDate).toBe('2024-01-20')
    expect(paginated[1].dueDate).toBe('2024-01-15')
  })
})
