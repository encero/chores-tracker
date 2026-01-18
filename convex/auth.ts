import { v } from 'convex/values'
import { query, mutation, internalMutation } from './_generated/server'
import { hashPin, generateSessionToken } from './lib/hash'

// Login with PIN, return session token
export const login = mutation({
  args: {
    pin: v.string(),
    rememberMe: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db.query('settings').first()
    if (!settings || !settings.pinHash) {
      return { success: false, error: 'No PIN set' }
    }

    // Verify PIN
    const pinHash = await hashPin(args.pin)
    if (pinHash !== settings.pinHash) {
      return { success: false, error: 'Incorrect PIN' }
    }

    // Generate session token
    const token = generateSessionToken()
    const durationDays = args.rememberMe ? 30 : settings.sessionDurationDays
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000

    // Store session
    await ctx.db.insert('sessions', {
      token,
      expiresAt,
    })

    return { success: true, token, expiresAt }
  },
})

// Verify if session token is valid
export const verifySession = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()

    if (!session) {
      return false
    }

    // Check if expired (cleanup will be handled by cron)
    if (session.expiresAt < Date.now()) {
      return false
    }

    return true
  },
})

// Logout - invalidate session
export const logout = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query('sessions')
      .withIndex('by_token', (q) => q.eq('token', args.token))
      .first()

    if (session) {
      await ctx.db.delete(session._id)
    }

    return { success: true }
  },
})

// Clean up expired sessions (called by cron)
export const cleanupExpiredSessions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    const sessions = await ctx.db.query('sessions').collect()

    let deleted = 0
    for (const session of sessions) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id)
        deleted++
      }
    }

    return { deleted }
  },
})
