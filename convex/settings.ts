import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx } from '@rjdellecese/confect/server'
import { mutation, query } from './confect'
import {
  NoPinSetError,
  SettingsAlreadyInitializedError,
  SettingsNotFoundError,
} from './errors'
import { hashPin } from './lib/hash'
import type { ConfectDataModel } from './confect'

// Schema for settings with system fields (for query results)
const SettingsWithSystemFieldsSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  pinHash: Schema.optional(Schema.String),
  sessionDurationDays: Schema.Number,
  currency: Schema.String,
  ttsLanguage: Schema.optional(Schema.String),
})

const InitializeArgs = Schema.Struct({
  pin: Schema.String,
  currency: Schema.optional(Schema.String),
  ttsLanguage: Schema.optional(Schema.String),
})

const UpdateArgs = Schema.Struct({
  currency: Schema.optional(Schema.String),
  sessionDurationDays: Schema.optional(Schema.Number),
  ttsLanguage: Schema.optional(Schema.String),
})

const ChangePinArgs = Schema.Struct({
  currentPin: Schema.String,
  newPin: Schema.String,
})

const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

const ChangePinResult = Schema.Union(
  Schema.Struct({
    success: Schema.Literal(true),
  }),
  Schema.Struct({
    success: Schema.Literal(false),
    error: Schema.String,
  })
)

// Get app settings
export const get = query({
  args: Schema.Struct({}),
  returns: Schema.NullOr(SettingsWithSystemFieldsSchema),
  handler: () =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()

      const settingsOpt = yield* db.query('settings').first()

      if (Option.isNone(settingsOpt)) {
        return null
      }

      const settings = settingsOpt.value
      return {
        _id: settings._id as string,
        _creationTime: settings._creationTime,
        pinHash: settings.pinHash,
        sessionDurationDays: settings.sessionDurationDays,
        currency: settings.currency,
        ttsLanguage: settings.ttsLanguage,
      }
    }),
})

// Initialize settings with PIN on first run
export const initialize = mutation({
  args: InitializeArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      // Check if settings already exist
      const existing = yield* db.query('settings').first()
      if (Option.isSome(existing)) {
        return yield* Effect.fail(new SettingsAlreadyInitializedError())
      }

      const pinHash = yield* Effect.promise(() => hashPin(args.pin))

      yield* db.insert('settings', {
        pinHash,
        sessionDurationDays: 7,
        currency: args.currency ?? '$',
        ttsLanguage: args.ttsLanguage ?? 'cs-CZ',
      })

      return { success: true }
    }),
})

// Update settings (currency, session duration, TTS language)
export const update = mutation({
  args: UpdateArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const settingsOpt = yield* db.query('settings').first()
      if (Option.isNone(settingsOpt)) {
        return yield* Effect.fail(new SettingsNotFoundError())
      }

      const settings = settingsOpt.value
      const updates: Record<string, string | number | undefined> = {}

      if (args.currency !== undefined) {
        updates.currency = args.currency
      }
      if (args.sessionDurationDays !== undefined) {
        updates.sessionDurationDays = args.sessionDurationDays
      }
      if (args.ttsLanguage !== undefined) {
        updates.ttsLanguage = args.ttsLanguage
      }

      yield* db.patch(settings._id, updates)

      return { success: true }
    }),
})

// Change parent PIN (requires current PIN verification)
export const changePin = mutation({
  args: ChangePinArgs,
  returns: ChangePinResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const settingsOpt = yield* db.query('settings').first()
      if (Option.isNone(settingsOpt)) {
        return yield* Effect.fail(new NoPinSetError())
      }

      const settings = settingsOpt.value
      if (!settings.pinHash) {
        return yield* Effect.fail(new NoPinSetError())
      }

      // Verify current PIN
      const currentHash = yield* Effect.promise(() => hashPin(args.currentPin))
      if (currentHash !== settings.pinHash) {
        return { success: false as const, error: 'Incorrect current PIN' }
      }

      // Set new PIN
      const newHash = yield* Effect.promise(() => hashPin(args.newPin))
      yield* db.patch(settings._id, { pinHash: newHash })

      return { success: true as const }
    }),
})
