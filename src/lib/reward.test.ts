import { describe, expect, test } from 'vitest'
import {
  calculateBaseRewardForDisplay,
  calculateDisplayedRewardForQuality,
  calculateEarnedReward,
  calculateRateAllEarnedReward,
  initializeEqualEfforts,
  redistributeEfforts,
  validateEffortTotal,
} from './reward'

describe('calculateBaseRewardForDisplay', () => {
  describe('single participant chore (non-joined)', () => {
    test('returns full reward for single participant', () => {
      const result = calculateBaseRewardForDisplay(1000, 1, false)
      expect(result).toBe(1000)
    })
  })

  describe('split chore (multiple participants, non-joined)', () => {
    test('returns full reward for each participant', () => {
      // Split chore: 2 kids, each gets the full 1000 cents
      const result = calculateBaseRewardForDisplay(1000, 2, false)
      expect(result).toBe(1000)
    })

    test('returns full reward regardless of participant count', () => {
      const result = calculateBaseRewardForDisplay(1000, 3, false)
      expect(result).toBe(1000)
    })
  })

  describe('joined chore (pooled reward)', () => {
    test('splits reward equally by default', () => {
      // Joined chore: 2 kids, pooled 1000 cents, each gets 500 by default
      const result = calculateBaseRewardForDisplay(1000, 2, true)
      expect(result).toBe(500)
    })

    test('splits reward equally for 3 participants', () => {
      // Joined chore: 3 kids, pooled 900 cents, each gets 300 by default
      const result = calculateBaseRewardForDisplay(900, 3, true)
      expect(result).toBeCloseTo(300, 5)
    })

    test('handles uneven splits', () => {
      // Joined chore: 3 kids, pooled 1000 cents, each gets ~333.33
      const result = calculateBaseRewardForDisplay(1000, 3, true)
      expect(result).toBeCloseTo(333.33, 1)
    })

    test('applies custom effort percentage', () => {
      // Joined chore: 2 kids, pooled 1000 cents, custom 70% effort
      const result = calculateBaseRewardForDisplay(1000, 2, true, 70)
      expect(result).toBe(700)
    })

    test('custom 100% effort gives full reward', () => {
      const result = calculateBaseRewardForDisplay(1000, 2, true, 100)
      expect(result).toBe(1000)
    })

    test('custom 0% effort gives zero reward', () => {
      const result = calculateBaseRewardForDisplay(1000, 2, true, 0)
      expect(result).toBe(0)
    })

    test('custom effort can exceed 100% for bonus scenarios', () => {
      // Kid did more than their share
      const result = calculateBaseRewardForDisplay(1000, 2, true, 150)
      expect(result).toBe(1500)
    })
  })
})

describe('calculateDisplayedRewardForQuality', () => {
  const baseReward = 1000

  test('failed quality returns 0', () => {
    expect(calculateDisplayedRewardForQuality(baseReward, 'failed')).toBe(0)
  })

  test('bad quality returns 50%', () => {
    expect(calculateDisplayedRewardForQuality(baseReward, 'bad')).toBe(500)
  })

  test('good quality returns 100%', () => {
    expect(calculateDisplayedRewardForQuality(baseReward, 'good')).toBe(1000)
  })

  test('excellent quality returns 125%', () => {
    expect(calculateDisplayedRewardForQuality(baseReward, 'excellent')).toBe(1250)
  })

  test('rounds to nearest cent', () => {
    // 333 * 0.5 = 166.5 -> 167
    expect(calculateDisplayedRewardForQuality(333, 'bad')).toBe(167)
    // 333 * 1.25 = 416.25 -> 416
    expect(calculateDisplayedRewardForQuality(333, 'excellent')).toBe(416)
  })
})

describe('calculateEarnedReward', () => {
  describe('single participant chore', () => {
    test('good quality gives full reward', () => {
      const result = calculateEarnedReward(1000, 100, 'good', false)
      expect(result).toBe(1000)
    })

    test('bad quality gives 50%', () => {
      const result = calculateEarnedReward(1000, 100, 'bad', false)
      expect(result).toBe(500)
    })

    test('excellent quality gives 125%', () => {
      const result = calculateEarnedReward(1000, 100, 'excellent', false)
      expect(result).toBe(1250)
    })

    test('failed quality gives 0', () => {
      const result = calculateEarnedReward(1000, 100, 'failed', false)
      expect(result).toBe(0)
    })
  })

  describe('split chore (non-joined, multiple participants)', () => {
    test('each participant gets full reward with good quality', () => {
      // Even though effort is 100, non-joined means full reward
      const result = calculateEarnedReward(1000, 100, 'good', false)
      expect(result).toBe(1000)
    })

    test('effort percentage is ignored for non-joined chores', () => {
      // Effort percentage doesn't matter for non-joined
      const result50 = calculateEarnedReward(1000, 50, 'good', false)
      const result100 = calculateEarnedReward(1000, 100, 'good', false)
      expect(result50).toBe(1000)
      expect(result100).toBe(1000)
    })
  })

  describe('joined chore (pooled reward)', () => {
    test('50% effort gives half of pooled reward', () => {
      // 1000 * 0.5 * 1.0 (good) = 500
      const result = calculateEarnedReward(1000, 50, 'good', true)
      expect(result).toBe(500)
    })

    test('33.33% effort gives third of pooled reward', () => {
      // 900 * (33.33/100) * 1.0 (good) = 300
      const result = calculateEarnedReward(900, 33.33, 'good', true)
      expect(result).toBeCloseTo(300, 0)
    })

    test('applies quality coefficient to effort-based reward', () => {
      // 1000 * 0.5 * 0.5 (bad) = 250
      const result = calculateEarnedReward(1000, 50, 'bad', true)
      expect(result).toBe(250)
    })

    test('excellent quality on 50% effort', () => {
      // 1000 * 0.5 * 1.25 (excellent) = 625
      const result = calculateEarnedReward(1000, 50, 'excellent', true)
      expect(result).toBe(625)
    })

    test('custom effort can exceed 100%', () => {
      // Kid did more work, gets 120% of pooled reward
      // 1000 * 1.2 * 1.0 (good) = 1200
      const result = calculateEarnedReward(1000, 120, 'good', true)
      expect(result).toBe(1200)
    })

    test('0% effort gives 0 reward', () => {
      const result = calculateEarnedReward(1000, 0, 'good', true)
      expect(result).toBe(0)
    })
  })
})

describe('calculateRateAllEarnedReward', () => {
  describe('joined chore', () => {
    test('calculates reward with effort and quality', () => {
      // 1000 * 50/100 * 1.0 (good) = 500
      const result = calculateRateAllEarnedReward(1000, 50, 'good', true)
      expect(result).toBe(500)
    })

    test('excellent quality with 60% effort', () => {
      // 1000 * 60/100 * 1.25 = 750
      const result = calculateRateAllEarnedReward(1000, 60, 'excellent', true)
      expect(result).toBe(750)
    })

    test('bad quality with 40% effort', () => {
      // 1000 * 40/100 * 0.5 = 200
      const result = calculateRateAllEarnedReward(1000, 40, 'bad', true)
      expect(result).toBe(200)
    })
  })

  describe('non-joined chore', () => {
    test('ignores effort percentage', () => {
      // Non-joined: each gets full reward * coefficient
      const result = calculateRateAllEarnedReward(1000, 50, 'good', false)
      expect(result).toBe(1000)
    })

    test('applies quality coefficient to full reward', () => {
      const result = calculateRateAllEarnedReward(1000, 50, 'excellent', false)
      expect(result).toBe(1250)
    })
  })
})

describe('validateEffortTotal', () => {
  test('returns true for exactly 100%', () => {
    const efforts = { child1: 50, child2: 50 }
    expect(validateEffortTotal(efforts)).toBe(true)
  })

  test('returns true within default tolerance', () => {
    const efforts = { child1: 50.05, child2: 50 }
    expect(validateEffortTotal(efforts)).toBe(true)
  })

  test('returns false when total is too low', () => {
    const efforts = { child1: 40, child2: 50 }
    expect(validateEffortTotal(efforts)).toBe(false)
  })

  test('returns false when total is too high', () => {
    const efforts = { child1: 60, child2: 50 }
    expect(validateEffortTotal(efforts)).toBe(false)
  })

  test('works with custom tolerance', () => {
    const efforts = { child1: 49, child2: 50 }
    expect(validateEffortTotal(efforts, 0.5)).toBe(false)
    expect(validateEffortTotal(efforts, 1.5)).toBe(true)
  })

  test('handles single participant', () => {
    const efforts = { child1: 100 }
    expect(validateEffortTotal(efforts)).toBe(true)
  })

  test('handles three participants', () => {
    const efforts = { child1: 33.33, child2: 33.33, child3: 33.34 }
    expect(validateEffortTotal(efforts)).toBe(true)
  })

  test('handles empty object', () => {
    const efforts = {}
    expect(validateEffortTotal(efforts)).toBe(false)
  })
})

describe('redistributeEfforts', () => {
  test('adjusts other participant proportionally when one changes', () => {
    const efforts = { child1: 50, child2: 50 }
    const result = redistributeEfforts(efforts, 'child1', 70)

    expect(result.child1).toBe(70)
    expect(result.child2).toBe(30)
  })

  test('distributes remaining equally when others have zero', () => {
    const efforts = { child1: 100, child2: 0 }
    const result = redistributeEfforts(efforts, 'child1', 50)

    expect(result.child1).toBe(50)
    expect(result.child2).toBe(50)
  })

  test('handles three participants', () => {
    const efforts = { child1: 40, child2: 30, child3: 30 }
    const result = redistributeEfforts(efforts, 'child1', 70)

    // Remaining 30% split proportionally: child2 had 30/60 = 0.5, child3 had 30/60 = 0.5
    expect(result.child1).toBe(70)
    expect(result.child2).toBe(15)
    expect(result.child3).toBe(15)
  })

  test('maintains total of 100%', () => {
    const efforts = { child1: 60, child2: 25, child3: 15 }
    const result = redistributeEfforts(efforts, 'child2', 40)

    const total = Object.values(result).reduce((sum, v) => sum + v, 0)
    expect(total).toBe(100)
  })

  test('handles single participant', () => {
    const efforts = { child1: 100 }
    const result = redistributeEfforts(efforts, 'child1', 80)

    expect(result.child1).toBe(80)
  })

  test('setting one to 100% zeros out others', () => {
    const efforts = { child1: 50, child2: 50 }
    const result = redistributeEfforts(efforts, 'child1', 100)

    expect(result.child1).toBe(100)
    expect(result.child2).toBe(0)
  })

  test('setting one to 0% distributes to others', () => {
    const efforts = { child1: 50, child2: 50 }
    const result = redistributeEfforts(efforts, 'child1', 0)

    expect(result.child1).toBe(0)
    expect(result.child2).toBe(100)
  })
})

describe('initializeEqualEfforts', () => {
  test('creates equal distribution for 2 participants', () => {
    const result = initializeEqualEfforts(['child1', 'child2'])

    expect(result.child1).toBe(50)
    expect(result.child2).toBe(50)
  })

  test('creates equal distribution for 3 participants', () => {
    const result = initializeEqualEfforts(['child1', 'child2', 'child3'])

    expect(result.child1).toBeCloseTo(33.33, 1)
    expect(result.child2).toBeCloseTo(33.33, 1)
    expect(result.child3).toBeCloseTo(33.33, 1)
  })

  test('handles single participant', () => {
    const result = initializeEqualEfforts(['child1'])

    expect(result.child1).toBe(100)
  })

  test('total equals 100%', () => {
    const result = initializeEqualEfforts(['a', 'b', 'c', 'd'])
    const total = Object.values(result).reduce((sum, v) => sum + v, 0)

    expect(total).toBe(100)
  })
})

describe('reward calculation scenarios', () => {
  describe('scenario: single kid doing a chore worth 10 Kc', () => {
    const totalReward = 1000 // 10 Kc in cents

    test('good quality earns full reward', () => {
      const baseReward = calculateBaseRewardForDisplay(totalReward, 1, false)
      const earned = calculateEarnedReward(totalReward, 100, 'good', false)

      expect(baseReward).toBe(1000)
      expect(earned).toBe(1000)
    })

    test('bad quality earns half reward', () => {
      const earned = calculateEarnedReward(totalReward, 100, 'bad', false)
      expect(earned).toBe(500)
    })

    test('excellent quality earns 125%', () => {
      const earned = calculateEarnedReward(totalReward, 100, 'excellent', false)
      expect(earned).toBe(1250)
    })
  })

  describe('scenario: split chore - 2 kids each doing same chore separately', () => {
    const totalReward = 1000 // Each kid can earn 10 Kc

    test('each kid gets full reward independently', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 100, 'good', false)
      const kid2Earned = calculateEarnedReward(totalReward, 100, 'good', false)

      expect(kid1Earned).toBe(1000)
      expect(kid2Earned).toBe(1000)
      // Total payout: 2000 cents (20 Kc)
    })

    test('different qualities for each kid', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 100, 'excellent', false)
      const kid2Earned = calculateEarnedReward(totalReward, 100, 'bad', false)

      expect(kid1Earned).toBe(1250)
      expect(kid2Earned).toBe(500)
    })
  })

  describe('scenario: joined chore - 2 kids working together on 10 Kc chore', () => {
    const totalReward = 1000 // Pooled 10 Kc

    test('equal effort and good quality splits reward evenly', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 50, 'good', true)
      const kid2Earned = calculateEarnedReward(totalReward, 50, 'good', true)

      expect(kid1Earned).toBe(500)
      expect(kid2Earned).toBe(500)
      // Total payout: 1000 cents (10 Kc)
    })

    test('unequal effort with same quality', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 70, 'good', true)
      const kid2Earned = calculateEarnedReward(totalReward, 30, 'good', true)

      expect(kid1Earned).toBe(700)
      expect(kid2Earned).toBe(300)
      // Total payout: 1000 cents (10 Kc)
    })

    test('same effort but different qualities', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 50, 'excellent', true)
      const kid2Earned = calculateEarnedReward(totalReward, 50, 'bad', true)

      expect(kid1Earned).toBe(625) // 500 * 1.25
      expect(kid2Earned).toBe(250) // 500 * 0.5
      // Total payout: 875 cents (8.75 Kc) - less than pool because of mixed quality
    })

    test('both excellent quality exceeds pool', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 50, 'excellent', true)
      const kid2Earned = calculateEarnedReward(totalReward, 50, 'excellent', true)

      expect(kid1Earned).toBe(625)
      expect(kid2Earned).toBe(625)
      // Total payout: 1250 cents (12.50 Kc) - exceeds pool due to excellent bonus
    })
  })

  describe('scenario: joined chore - 3 kids working together', () => {
    const totalReward = 900 // 9 Kc pool

    test('equal effort gives 3 Kc each', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 33.33, 'good', true)
      const kid2Earned = calculateEarnedReward(totalReward, 33.33, 'good', true)
      const kid3Earned = calculateEarnedReward(totalReward, 33.34, 'good', true)

      expect(kid1Earned).toBe(300)
      expect(kid2Earned).toBe(300)
      expect(kid3Earned).toBe(300)
    })

    test('one kid did most of the work', () => {
      const kid1Earned = calculateEarnedReward(totalReward, 80, 'good', true)
      const kid2Earned = calculateEarnedReward(totalReward, 10, 'good', true)
      const kid3Earned = calculateEarnedReward(totalReward, 10, 'good', true)

      expect(kid1Earned).toBe(720) // 7.20 Kc
      expect(kid2Earned).toBe(90)  // 0.90 Kc
      expect(kid3Earned).toBe(90)  // 0.90 Kc
    })
  })
})

describe('UI display calculations', () => {
  describe('rating buttons should show correct amounts', () => {
    test('single chore rating buttons', () => {
      const baseReward = calculateBaseRewardForDisplay(1000, 1, false)

      expect(calculateDisplayedRewardForQuality(baseReward, 'failed')).toBe(0)
      expect(calculateDisplayedRewardForQuality(baseReward, 'bad')).toBe(500)
      expect(calculateDisplayedRewardForQuality(baseReward, 'good')).toBe(1000)
      expect(calculateDisplayedRewardForQuality(baseReward, 'excellent')).toBe(1250)
    })

    test('split chore rating buttons (2 kids)', () => {
      // Each kid sees full reward on buttons
      const baseReward = calculateBaseRewardForDisplay(1000, 2, false)

      expect(baseReward).toBe(1000)
      expect(calculateDisplayedRewardForQuality(baseReward, 'good')).toBe(1000)
    })

    test('joined chore rating buttons (2 kids, equal effort)', () => {
      // Each kid sees half the pool on buttons
      const baseReward = calculateBaseRewardForDisplay(1000, 2, true)

      expect(baseReward).toBe(500)
      expect(calculateDisplayedRewardForQuality(baseReward, 'good')).toBe(500)
      expect(calculateDisplayedRewardForQuality(baseReward, 'excellent')).toBe(625)
    })

    test('joined chore with custom effort shows adjusted amounts', () => {
      // Kid with 70% effort should see 700 as base
      const baseReward = calculateBaseRewardForDisplay(1000, 2, true, 70)

      expect(baseReward).toBe(700)
      expect(calculateDisplayedRewardForQuality(baseReward, 'good')).toBe(700)
      expect(calculateDisplayedRewardForQuality(baseReward, 'bad')).toBe(350)
    })
  })
})
