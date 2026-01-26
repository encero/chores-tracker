import { v } from 'convex/values'
import { internalMutation, mutation, query } from './_generated/server'
import { generateAccessCode } from './lib/hash'

// List all children
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('children').collect()
  },
})

// Get single child by ID
export const get = query({
  args: {
    id: v.id('children'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Get child by access code (for kid view)
export const getByAccessCode = query({
  args: {
    accessCode: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('children')
      .withIndex('by_access_code', (q) => q.eq('accessCode', args.accessCode))
      .first()
  },
})

// Create a new child
export const create = mutation({
  args: {
    name: v.string(),
    avatarEmoji: v.string(),
  },
  handler: async (ctx, args) => {
    // Generate unique access code
    let accessCode: string
    let attempts = 0
    do {
      accessCode = generateAccessCode()
      const existing = await ctx.db
        .query('children')
        .withIndex('by_access_code', (q) => q.eq('accessCode', accessCode))
        .first()
      if (!existing) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      throw new Error('Could not generate unique access code')
    }

    const id = await ctx.db.insert('children', {
      name: args.name,
      avatarEmoji: args.avatarEmoji,
      accessCode,
      balance: 0,
    })

    return { id, accessCode }
  },
})

// Update child info
export const update = mutation({
  args: {
    id: v.id('children'),
    name: v.optional(v.string()),
    avatarEmoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id)
    if (!child) {
      throw new Error('Child not found')
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.avatarEmoji !== undefined && { avatarEmoji: args.avatarEmoji }),
    })

    return { success: true }
  },
})

// Delete child
export const remove = mutation({
  args: {
    id: v.id('children'),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id)
    if (!child) {
      throw new Error('Child not found')
    }

    // Delete related data
    // Delete chore participants and track affected instances
    const participants = await ctx.db
      .query('choreParticipants')
      .withIndex('by_child', (q) => q.eq('childId', args.id))
      .collect()
    const affectedInstanceIds = new Set(participants.map((p) => p.choreInstanceId))
    for (const p of participants) {
      await ctx.db.delete(p._id)
    }

    // Delete choreInstances that now have no participants
    for (const instanceId of affectedInstanceIds) {
      const remainingParticipants = await ctx.db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', instanceId))
        .first()
      if (!remainingParticipants) {
        await ctx.db.delete(instanceId)
      }
    }

    // Delete withdrawals
    const withdrawals = await ctx.db
      .query('withdrawals')
      .withIndex('by_child', (q) => q.eq('childId', args.id))
      .collect()
    for (const w of withdrawals) {
      await ctx.db.delete(w._id)
    }

    // Remove child from scheduledChores.childIds arrays
    const allSchedules = await ctx.db.query('scheduledChores').collect()
    for (const schedule of allSchedules) {
      if (schedule.childIds.includes(args.id)) {
        const newChildIds = schedule.childIds.filter((id) => id !== args.id)
        if (newChildIds.length === 0 && !schedule.isOptional) {
          // Schedule has no children and isn't optional - deactivate it
          await ctx.db.patch(schedule._id, { childIds: newChildIds, isActive: false })
        } else {
          await ctx.db.patch(schedule._id, { childIds: newChildIds })
        }
      }
    }

    await ctx.db.delete(args.id)

    return { success: true }
  },
})

// Regenerate access code
export const regenerateAccessCode = mutation({
  args: {
    id: v.id('children'),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id)
    if (!child) {
      throw new Error('Child not found')
    }

    // Generate unique access code
    let accessCode: string
    let attempts = 0
    do {
      accessCode = generateAccessCode()
      const existing = await ctx.db
        .query('children')
        .withIndex('by_access_code', (q) => q.eq('accessCode', accessCode))
        .first()
      if (!existing) break
      attempts++
    } while (attempts < 10)

    if (attempts >= 10) {
      throw new Error('Could not generate unique access code')
    }

    await ctx.db.patch(args.id, { accessCode })

    return { accessCode }
  },
})

// Update balance (internal use)
export const updateBalance = mutation({
  args: {
    id: v.id('children'),
    amount: v.number(), // Can be positive or negative
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id)
    if (!child) {
      throw new Error('Child not found')
    }

    const newBalance = child.balance + args.amount
    if (newBalance < 0) {
      throw new Error('Balance cannot be negative')
    }

    await ctx.db.patch(args.id, { balance: newBalance })

    return { newBalance }
  },
})

// Manual balance adjustment with note (for parent corrections)
export const adjustBalance = mutation({
  args: {
    id: v.id('children'),
    newBalance: v.number(), // The new absolute balance in cents
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.id)
    if (!child) {
      throw new Error('Child not found')
    }

    if (args.newBalance < 0) {
      throw new Error('Balance cannot be negative')
    }

    const difference = args.newBalance - child.balance

    // Record the adjustment as a balance history entry
    if (difference !== 0) {
      await ctx.db.insert('withdrawals', {
        childId: args.id,
        amount: difference, // Signed amount (positive = added, negative = removed)
        createdAt: Date.now(),
        note: args.note || 'Balance adjustment',
      })
    }

    await ctx.db.patch(args.id, { balance: args.newBalance })

    return { newBalance: args.newBalance, difference }
  },
})

// Private mutation to cleanup orphaned child references
// Run this if data gets out of sync (e.g., after failed deletions)
export const cleanupOrphanedReferences = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all valid child IDs
    const children = await ctx.db.query('children').collect()
    const validChildIds = new Set(children.map((c) => c._id))

    let cleanedSchedules = 0
    let deletedParticipants = 0
    let deletedInstances = 0
    let deletedWithdrawals = 0

    // Clean up scheduledChores.childIds - remove orphaned references
    const allSchedules = await ctx.db.query('scheduledChores').collect()
    for (const schedule of allSchedules) {
      const validIds = schedule.childIds.filter((id) => validChildIds.has(id))
      if (validIds.length !== schedule.childIds.length) {
        if (validIds.length === 0 && !schedule.isOptional) {
          // Schedule has no valid children and isn't optional - deactivate it
          await ctx.db.patch(schedule._id, { childIds: validIds, isActive: false })
        } else {
          await ctx.db.patch(schedule._id, { childIds: validIds })
        }
        cleanedSchedules++
      }
    }

    // Delete choreParticipants with orphaned childId
    const allParticipants = await ctx.db.query('choreParticipants').collect()
    for (const participant of allParticipants) {
      if (!validChildIds.has(participant.childId)) {
        await ctx.db.delete(participant._id)
        deletedParticipants++
      }
    }

    // Delete choreInstances with no participants
    const allInstances = await ctx.db.query('choreInstances').collect()
    for (const instance of allInstances) {
      const hasParticipants = await ctx.db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
        .first()
      if (!hasParticipants) {
        await ctx.db.delete(instance._id)
        deletedInstances++
      }
    }

    // Delete withdrawals with orphaned childId
    const allWithdrawals = await ctx.db.query('withdrawals').collect()
    for (const withdrawal of allWithdrawals) {
      if (!validChildIds.has(withdrawal.childId)) {
        await ctx.db.delete(withdrawal._id)
        deletedWithdrawals++
      }
    }

    return {
      cleanedSchedules,
      deletedParticipants,
      deletedInstances,
      deletedWithdrawals,
    }
  },
})
