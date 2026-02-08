import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { hashPin } from './lib/hash'
import { requireAuth } from './lib/auth'

// Get app settings (excludes sensitive fields like pinHash)
export const get = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query('settings').first()
    if (!settings) return null
    const { pinHash: _pinHash, ...safeSettings } = settings
    return { ...safeSettings, isPinSet: !!_pinHash }
  },
})

// Initialize settings with PIN on first run
export const initialize = mutation({
  args: {
    pin: v.string(),
    currency: v.optional(v.string()),
    ttsLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existing = await ctx.db.query('settings').first()
    if (existing) {
      throw new Error('Settings already initialized')
    }

    if (args.pin.length < 4 || args.pin.length > 6) {
      throw new Error('PIN must be 4-6 digits')
    }

    const pinHash = await hashPin(args.pin)

    await ctx.db.insert('settings', {
      pinHash,
      sessionDurationDays: 7,
      currency: args.currency ?? '$',
      ttsLanguage: args.ttsLanguage ?? 'cs-CZ',
    })

    return { success: true }
  },
})

// Update settings (currency, session duration, TTS language) - requires auth
export const update = mutation({
  args: {
    token: v.optional(v.string()),
    currency: v.optional(v.string()),
    sessionDurationDays: v.optional(v.number()),
    ttsLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx.db, args.token)

    const settings = await ctx.db.query('settings').first()
    if (!settings) {
      throw new Error('Settings not found')
    }

    // Validate sessionDurationDays
    if (args.sessionDurationDays !== undefined) {
      if (args.sessionDurationDays < 1 || args.sessionDurationDays > 365) {
        throw new Error('Session duration must be between 1 and 365 days')
      }
    }

    await ctx.db.patch(settings._id, {
      ...(args.currency !== undefined && { currency: args.currency }),
      ...(args.sessionDurationDays !== undefined && {
        sessionDurationDays: args.sessionDurationDays,
      }),
      ...(args.ttsLanguage !== undefined && { ttsLanguage: args.ttsLanguage }),
    })

    return { success: true }
  },
})

// Change parent PIN (requires auth + current PIN verification)
export const changePin = mutation({
  args: {
    token: v.optional(v.string()),
    currentPin: v.string(),
    newPin: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx.db, args.token)

    const settings = await ctx.db.query('settings').first()
    if (!settings || !settings.pinHash) {
      throw new Error('No PIN set')
    }

    if (args.newPin.length < 4 || args.newPin.length > 6) {
      throw new Error('New PIN must be 4-6 digits')
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
