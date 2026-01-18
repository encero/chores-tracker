import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
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
    // Delete chore participants
    const participants = await ctx.db
      .query('choreParticipants')
      .withIndex('by_child', (q) => q.eq('childId', args.id))
      .collect()
    for (const p of participants) {
      await ctx.db.delete(p._id)
    }

    // Delete withdrawals
    const withdrawals = await ctx.db
      .query('withdrawals')
      .withIndex('by_child', (q) => q.eq('childId', args.id))
      .collect()
    for (const w of withdrawals) {
      await ctx.db.delete(w._id)
    }

    // Note: We don't delete scheduledChores as they might have other children
    // The UI should handle removing this child from childIds arrays

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

    // Record the adjustment as a withdrawal (if reducing) or add note
    if (difference !== 0) {
      await ctx.db.insert('withdrawals', {
        childId: args.id,
        amount: Math.abs(difference),
        createdAt: Date.now(),
        note: `${difference > 0 ? 'Balance adjustment (+)' : 'Balance adjustment (-)'}${args.note ? `: ${args.note}` : ''}`,
      })
    }

    await ctx.db.patch(args.id, { balance: args.newBalance })

    return { newBalance: args.newBalance, difference }
  },
})
