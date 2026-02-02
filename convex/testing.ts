import { mutation } from './_generated/server'
import { hashPin } from './lib/hash'

// Test-only mutations - protected by IS_TEST environment variable

export const resetDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    // Only allow in test environment
    const isTest = process.env.IS_TEST === 'true'
    if (!isTest) {
      throw new Error('resetDatabase only allowed in test environment')
    }

    const tables = [
      'settings',
      'sessions',
      'children',
      'choreTemplates',
      'scheduledChores',
      'choreInstances',
      'choreParticipants',
      'withdrawals',
    ] as const

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect()
      await Promise.all(docs.map((doc) => ctx.db.delete(doc._id)))
    }
  },
})

export const seedTestData = mutation({
  args: {},
  handler: async (ctx) => {
    // Only allow in test environment
    const isTest = process.env.IS_TEST === 'true'
    if (!isTest) {
      throw new Error('seedTestData only allowed in test environment')
    }

    // Create test settings with PIN "1234"
    const pinHash = await hashPin('1234')
    await ctx.db.insert('settings', {
      pinHash,
      currency: 'Kč',
      sessionDurationDays: 7,
      ttsLanguage: 'cs-CZ',
    })

    // Create test child
    await ctx.db.insert('children', {
      name: 'Test Child',
      avatarEmoji: '🧒',
      accessCode: 'TEST123',
      balance: 0,
    })

    // Create a chore template
    const templateId = await ctx.db.insert('choreTemplates', {
      name: 'Uklidit pokoj',
      description: 'Uklidit a vysát pokoj',
      defaultReward: 5000, // 50 Kč
      icon: '🧹',
    })

    return { templateId }
  },
})

export const seedReviewTestData = mutation({
  args: {},
  handler: async (ctx) => {
    // Only allow in test environment
    const isTest = process.env.IS_TEST === 'true'
    if (!isTest) {
      throw new Error('seedReviewTestData only allowed in test environment')
    }

    // Create test settings with PIN "1234"
    const pinHash = await hashPin('1234')
    await ctx.db.insert('settings', {
      pinHash,
      currency: 'Kč',
      sessionDurationDays: 7,
      ttsLanguage: 'cs-CZ',
    })

    // Create two test children
    const child1Id = await ctx.db.insert('children', {
      name: 'Alice',
      avatarEmoji: '👧',
      accessCode: 'ALICE1',
      balance: 0,
    })

    const child2Id = await ctx.db.insert('children', {
      name: 'Bob',
      avatarEmoji: '👦',
      accessCode: 'BOB123',
      balance: 0,
    })

    // Create chore templates
    const singleTemplateId = await ctx.db.insert('choreTemplates', {
      name: 'Uklidit pokoj',
      description: 'Uklidit a vysát pokoj',
      defaultReward: 1000, // 10 Kč
      icon: '🧹',
    })

    const splitTemplateId = await ctx.db.insert('choreTemplates', {
      name: 'Vynést koš',
      description: 'Vynést odpadkový koš',
      defaultReward: 500, // 5 Kč per kid
      icon: '🗑️',
    })

    const joinedTemplateId = await ctx.db.insert('choreTemplates', {
      name: 'Umýt nádobí',
      description: 'Umýt všechno nádobí',
      defaultReward: 2000, // 20 Kč pooled
      icon: '🍽️',
    })

    const today = new Date().toISOString().split('T')[0]

    // Create scheduled chores
    const singleScheduleId = await ctx.db.insert('scheduledChores', {
      choreTemplateId: singleTemplateId,
      childIds: [child1Id],
      reward: 1000,
      scheduleType: 'once',
      isJoined: false,
      isOptional: false,
      startDate: today,
      isActive: true,
    })

    const splitScheduleId = await ctx.db.insert('scheduledChores', {
      choreTemplateId: splitTemplateId,
      childIds: [child1Id, child2Id],
      reward: 500,
      scheduleType: 'once',
      isJoined: false, // Each kid gets full reward
      isOptional: false,
      startDate: today,
      isActive: true,
    })

    const joinedScheduleId = await ctx.db.insert('scheduledChores', {
      choreTemplateId: joinedTemplateId,
      childIds: [child1Id, child2Id],
      reward: 2000,
      scheduleType: 'once',
      isJoined: true, // Pooled reward
      isOptional: false,
      startDate: today,
      isActive: true,
    })

    // Create chore instances ready for review (marked as done)

    // 1. Single chore - one kid, done
    const singleInstanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId: singleScheduleId,
      dueDate: today,
      isJoined: false,
      status: 'pending',
      totalReward: 1000,
    })
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: singleInstanceId,
      childId: child1Id,
      status: 'done',
      completedAt: Date.now(),
    })

    // 2. Split chore - two kids, both done
    const splitInstanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId: splitScheduleId,
      dueDate: today,
      isJoined: false,
      status: 'pending',
      totalReward: 500,
    })
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: splitInstanceId,
      childId: child1Id,
      status: 'done',
      completedAt: Date.now(),
    })
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: splitInstanceId,
      childId: child2Id,
      status: 'done',
      completedAt: Date.now(),
    })

    // 3. Joined chore - two kids, both done
    const joinedInstanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId: joinedScheduleId,
      dueDate: today,
      isJoined: true,
      status: 'pending',
      totalReward: 2000,
    })
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: joinedInstanceId,
      childId: child1Id,
      status: 'done',
      completedAt: Date.now(),
    })
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: joinedInstanceId,
      childId: child2Id,
      status: 'done',
      completedAt: Date.now(),
    })

    return {
      child1Id,
      child2Id,
      singleInstanceId,
      splitInstanceId,
      joinedInstanceId,
    }
  },
})
