import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx } from '@rjdellecese/confect/server'
import { internalMutation, mutation, query } from './confect'
import { generateSessionToken, hashPin } from './lib/hash'
import type { ConfectDataModel } from './confect'

// Schema definitions for function args and returns
const LoginArgs = Schema.Struct({
  pin: Schema.String,
  rememberMe: Schema.optional(Schema.Boolean),
})

const LoginResult = Schema.Union(
  Schema.Struct({
    success: Schema.Literal(true),
    token: Schema.String,
    expiresAt: Schema.Number,
  }),
  Schema.Struct({
    success: Schema.Literal(false),
    error: Schema.String,
  })
)

const VerifySessionArgs = Schema.Struct({
  token: Schema.String,
})

const LogoutArgs = Schema.Struct({
  token: Schema.String,
})

const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

const CleanupResult = Schema.Struct({
  deleted: Schema.Number,
})

// Login with PIN, return session token
export const login = mutation({
  args: LoginArgs,
  returns: LoginResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const settingsOpt = yield* db.query('settings').first()

      if (Option.isNone(settingsOpt)) {
        return { success: false as const, error: 'No PIN set' }
      }

      const settings = settingsOpt.value
      if (!settings.pinHash) {
        return { success: false as const, error: 'No PIN set' }
      }

      // Verify PIN
      const pinHash = yield* Effect.promise(() => hashPin(args.pin))
      if (pinHash !== settings.pinHash) {
        return { success: false as const, error: 'Incorrect PIN' }
      }

      // Generate session token
      const token = generateSessionToken()
      const durationDays = args.rememberMe ? 30 : settings.sessionDurationDays
      const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000

      // Store session
      yield* db.insert('sessions', {
        token,
        expiresAt,
      })

      return { success: true as const, token, expiresAt }
    }),
})

// Verify if session token is valid
export const verifySession = query({
  args: VerifySessionArgs,
  returns: Schema.Boolean,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()

      const sessionOpt = yield* db
        .query('sessions')
        .withIndex('by_token', (q) => q.eq('token', args.token))
        .first()

      if (Option.isNone(sessionOpt)) {
        return false
      }

      const session = sessionOpt.value

      // Check if expired (cleanup will be handled by cron)
      if (session.expiresAt < Date.now()) {
        return false
      }

      return true
    }),
})

// Logout - invalidate session
export const logout = mutation({
  args: LogoutArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const sessionOpt = yield* db
        .query('sessions')
        .withIndex('by_token', (q) => q.eq('token', args.token))
        .first()

      if (Option.isSome(sessionOpt)) {
        yield* db.delete(sessionOpt.value._id)
      }

      return { success: true }
    }),
})

// Clean up expired sessions (called by cron)
export const cleanupExpiredSessions = internalMutation({
  args: Schema.Struct({}),
  returns: CleanupResult,
  handler: () =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const now = Date.now()
      const sessions = yield* db.query('sessions').collect()

      let deleted = 0
      for (const session of sessions) {
        if (session.expiresAt < now) {
          yield* db.delete(session._id)
          deleted++
        }
      }

      return { deleted }
    }),
})
