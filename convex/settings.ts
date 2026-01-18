import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { hashPin } from './lib/hash'

// Get app settings
export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query('settings').first()
    return settings
  },
})

// Initialize settings with PIN on first run
export const initialize = mutation({
  args: {
    pin: v.string(),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existing = await ctx.db.query('settings').first()
    if (existing) {
      throw new Error('Settings already initialized')
    }

    const pinHash = await hashPin(args.pin)

    await ctx.db.insert('settings', {
      pinHash,
      sessionDurationDays: 7,
      currency: args.currency ?? '$',
    })

    return { success: true }
  },
})

// Update settings (currency, session duration)
export const update = mutation({
  args: {
    currency: v.optional(v.string()),
    sessionDurationDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('settings').first()
    if (!settings) {
      throw new Error('Settings not found')
    }

    await ctx.db.patch(settings._id, {
      ...(args.currency !== undefined && { currency: args.currency }),
      ...(args.sessionDurationDays !== undefined && {
        sessionDurationDays: args.sessionDurationDays,
      }),
    })

    return { success: true }
  },
})

// Change parent PIN (requires current PIN verification)
export const changePin = mutation({
  args: {
    currentPin: v.string(),
    newPin: v.string(),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('settings').first()
    if (!settings || !settings.pinHash) {
      throw new Error('No PIN set')
    }

    // Verify current PIN
    const currentHash = await hashPin(args.currentPin)
    if (currentHash !== settings.pinHash) {
      return { success: false, error: 'Incorrect current PIN' }
    }

    // Set new PIN
    const newHash = await hashPin(args.newPin)
    await ctx.db.patch(settings._id, { pinHash: newHash })

    return { success: true }
  },
})
