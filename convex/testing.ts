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
    const childId = await ctx.db.insert('children', {
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

    // Create a scheduled chore for testing
    const today = new Date().toISOString().split('T')[0]
    const scheduledChoreId = await ctx.db.insert('scheduledChores', {
      childIds: [childId],
      choreTemplateId: templateId,
      reward: 5000, // 50 Kč
      isJoined: false,
      scheduleType: 'once',
      startDate: today,
      isActive: true,
    })

    // Create a chore instance for today
    const instanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId,
      dueDate: today,
      isJoined: false,
      status: 'pending',
      totalReward: 5000,
    })

    // Create participant record
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: instanceId,
      childId,
      status: 'pending',
    })

    return { templateId, childId, scheduledChoreId, instanceId }
  },
})
