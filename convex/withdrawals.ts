import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

// List withdrawals for a child
export const list = query({
  args: {
    childId: v.id('children'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    return await ctx.db
      .query('withdrawals')
      .withIndex('by_child', (q) => q.eq('childId', args.childId))
      .order('desc')
      .take(limit)
  },
})

// Create a withdrawal
export const create = mutation({
  args: {
    childId: v.id('children'),
    amount: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const child = await ctx.db.get(args.childId)
    if (!child) {
      throw new Error('Child not found')
    }

    if (args.amount <= 0) {
      throw new Error('Amount must be positive')
    }

    if (args.amount > child.balance) {
      throw new Error('Insufficient balance')
    }

    // Create withdrawal record (negative amount)
    const id = await ctx.db.insert('withdrawals', {
      childId: args.childId,
      amount: -args.amount,
      createdAt: Date.now(),
      note: args.note,
    })

    // Update balance
    await ctx.db.patch(args.childId, {
      balance: child.balance - args.amount,
    })

    return { id, newBalance: child.balance - args.amount }
  },
})
