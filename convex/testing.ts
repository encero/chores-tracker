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

// Seed data for joined chore testing - creates two kids with a shared chore
export const seedJoinedChoreTestData = mutation({
  args: {},
  handler: async (ctx) => {
    // Only allow in test environment
    const isTest = process.env.IS_TEST === 'true'
    if (!isTest) {
      throw new Error('seedJoinedChoreTestData only allowed in test environment')
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
    const childAId = await ctx.db.insert('children', {
      name: 'Anna',
      avatarEmoji: '👧',
      accessCode: 'ANNA01',
      balance: 0,
    })

    const childBId = await ctx.db.insert('children', {
      name: 'Ben',
      avatarEmoji: '👦',
      accessCode: 'BEN001',
      balance: 0,
    })

    // Create a chore template for joined chore
    const templateId = await ctx.db.insert('choreTemplates', {
      name: 'Uklidit obývák',
      description: 'Společný úklid obývacího pokoje',
      defaultReward: 10000, // 100 Kč total
      icon: '🛋️',
    })

    // Create scheduled chore for both kids (joined)
    const today = new Date().toISOString().split('T')[0]
    const scheduledChoreId = await ctx.db.insert('scheduledChores', {
      childIds: [childAId, childBId],
      choreTemplateId: templateId,
      reward: 10000,
      isJoined: true,
      scheduleType: 'once',
      startDate: today,
      isActive: true,
    })

    // Create the chore instance for today
    const instanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId,
      dueDate: today,
      isJoined: true,
      status: 'pending',
      totalReward: 10000,
    })

    // Create participant records for both children
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: instanceId,
      childId: childAId,
      status: 'pending',
    })

    await ctx.db.insert('choreParticipants', {
      choreInstanceId: instanceId,
      childId: childBId,
      status: 'pending',
    })

    return { childAId, childBId, templateId, scheduledChoreId, instanceId }
  },
})
