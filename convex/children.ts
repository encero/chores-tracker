import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx, Id } from '@rjdellecese/confect/server'
import { internalMutation, mutation, query } from './confect'
import {
  AccessCodeGenerationError,
  ChildNotFoundError,
  NegativeBalanceError,
} from './errors'
import { generateAccessCode } from './lib/hash'
import type { ConfectDataModel } from './confect'

// Schema definitions
const ChildSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  avatarEmoji: Schema.String,
  accessCode: Schema.String,
  balance: Schema.Number,
})

const ChildIdArgs = Schema.Struct({
  id: Id.Id('children'),
})

const AccessCodeArgs = Schema.Struct({
  accessCode: Schema.String,
})

const CreateChildArgs = Schema.Struct({
  name: Schema.String,
  avatarEmoji: Schema.String,
})

const CreateChildResult = Schema.Struct({
  id: Id.Id('children'),
  accessCode: Schema.String,
})

const UpdateChildArgs = Schema.Struct({
  id: Id.Id('children'),
  name: Schema.optional(Schema.String),
  avatarEmoji: Schema.optional(Schema.String),
})

const UpdateBalanceArgs = Schema.Struct({
  id: Id.Id('children'),
  amount: Schema.Number,
})

const AdjustBalanceArgs = Schema.Struct({
  id: Id.Id('children'),
  newBalance: Schema.Number,
  note: Schema.optional(Schema.String),
})

const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

const NewBalanceResult = Schema.Struct({
  newBalance: Schema.Number,
})

const AccessCodeResult = Schema.Struct({
  accessCode: Schema.String,
})

const AdjustBalanceResult = Schema.Struct({
  newBalance: Schema.Number,
  difference: Schema.Number,
})

const CleanupResult = Schema.Struct({
  cleanedSchedules: Schema.Number,
  deletedParticipants: Schema.Number,
  deletedInstances: Schema.Number,
  deletedWithdrawals: Schema.Number,
})

// Helper to generate unique access code
const generateUniqueAccessCode = () =>
  Effect.gen(function* () {
    const { db } = yield* ConfectMutationCtx<ConfectDataModel>()
    let attempts = 0
    while (attempts < 10) {
      const accessCode = generateAccessCode()
      const existing = yield* db
        .query('children')
        .withIndex('by_access_code', (q) => q.eq('accessCode', accessCode))
        .first()
      if (Option.isNone(existing)) {
        return accessCode
      }
      attempts++
    }
    return yield* Effect.fail(new AccessCodeGenerationError())
  })

// List all children
export const list = query({
  args: Schema.Struct({}),
  returns: Schema.Array(ChildSchema),
  handler: () =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const children = yield* db.query('children').collect()
      return children.map((c) => ({
        _id: c._id as string,
        _creationTime: c._creationTime,
        name: c.name,
        avatarEmoji: c.avatarEmoji,
        accessCode: c.accessCode,
        balance: c.balance,
      }))
    }),
})

// Get single child by ID
export const get = query({
  args: ChildIdArgs,
  returns: Schema.NullOr(ChildSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return null
      }
      const c = childOpt.value
      return {
        _id: c._id as string,
        _creationTime: c._creationTime,
        name: c.name,
        avatarEmoji: c.avatarEmoji,
        accessCode: c.accessCode,
        balance: c.balance,
      }
    }),
})

// Get child by access code (for kid view)
export const getByAccessCode = query({
  args: AccessCodeArgs,
  returns: Schema.NullOr(ChildSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const childOpt = yield* db
        .query('children')
        .withIndex('by_access_code', (q) => q.eq('accessCode', args.accessCode))
        .first()
      if (Option.isNone(childOpt)) {
        return null
      }
      const c = childOpt.value
      return {
        _id: c._id as string,
        _creationTime: c._creationTime,
        name: c.name,
        avatarEmoji: c.avatarEmoji,
        accessCode: c.accessCode,
        balance: c.balance,
      }
    }),
})

// Create a new child
export const create = mutation({
  args: CreateChildArgs,
  returns: CreateChildResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      // Generate unique access code
      const accessCode = yield* generateUniqueAccessCode()

      const id = yield* db.insert('children', {
        name: args.name,
        avatarEmoji: args.avatarEmoji,
        accessCode,
        balance: 0,
      })

      return { id, accessCode }
    }),
})

// Update child info
export const update = mutation({
  args: UpdateChildArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.id }))
      }

      const updates: Record<string, string | undefined> = {}
      if (args.name !== undefined) {
        updates.name = args.name
      }
      if (args.avatarEmoji !== undefined) {
        updates.avatarEmoji = args.avatarEmoji
      }

      yield* db.patch(args.id, updates)

      return { success: true }
    }),
})

// Delete child
export const remove = mutation({
  args: ChildIdArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.id }))
      }

      // Delete related data
      // Delete chore participants and track affected instances
      const participants = yield* db
        .query('choreParticipants')
        .withIndex('by_child', (q) => q.eq('childId', args.id))
        .collect()

      const affectedInstanceIds = new Set(participants.map((p) => p.choreInstanceId))
      for (const p of participants) {
        yield* db.delete(p._id)
      }

      // Delete choreInstances that now have no participants
      for (const instanceId of affectedInstanceIds) {
        const remainingParticipantsOpt = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instanceId))
          .first()
        if (Option.isNone(remainingParticipantsOpt)) {
          yield* db.delete(instanceId)
        }
      }

      // Delete withdrawals
      const withdrawals = yield* db
        .query('withdrawals')
        .withIndex('by_child', (q) => q.eq('childId', args.id))
        .collect()
      for (const w of withdrawals) {
        yield* db.delete(w._id)
      }

      // Remove child from scheduledChores.childIds arrays
      const allSchedules = yield* db.query('scheduledChores').collect()
      for (const schedule of allSchedules) {
        if (schedule.childIds.includes(args.id)) {
          const newChildIds = schedule.childIds.filter((id) => id !== args.id)
          if (newChildIds.length === 0 && !schedule.isOptional) {
            // Schedule has no children and isn't optional - deactivate it
            yield* db.patch(schedule._id, { childIds: newChildIds, isActive: false })
          } else {
            yield* db.patch(schedule._id, { childIds: newChildIds })
          }
        }
      }

      yield* db.delete(args.id)

      return { success: true }
    }),
})

// Regenerate access code
export const regenerateAccessCode = mutation({
  args: ChildIdArgs,
  returns: AccessCodeResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.id }))
      }

      // Generate unique access code
      const accessCode = yield* generateUniqueAccessCode()

      yield* db.patch(args.id, { accessCode })

      return { accessCode }
    }),
})

// Update balance (internal use)
export const updateBalance = mutation({
  args: UpdateBalanceArgs,
  returns: NewBalanceResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.id }))
      }

      const child = childOpt.value
      const newBalance = child.balance + args.amount
      if (newBalance < 0) {
        return yield* Effect.fail(new NegativeBalanceError())
      }

      yield* db.patch(args.id, { balance: newBalance })

      return { newBalance }
    }),
})

// Manual balance adjustment with note (for parent corrections)
export const adjustBalance = mutation({
  args: AdjustBalanceArgs,
  returns: AdjustBalanceResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.id)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.id }))
      }

      const child = childOpt.value

      if (args.newBalance < 0) {
        return yield* Effect.fail(new NegativeBalanceError())
      }

      const difference = args.newBalance - child.balance

      // Record the adjustment as a balance history entry
      if (difference !== 0) {
        yield* db.insert('withdrawals', {
          childId: args.id,
          amount: difference, // Signed amount (positive = added, negative = removed)
          createdAt: Date.now(),
          note: args.note ?? 'Balance adjustment',
        })
      }

      yield* db.patch(args.id, { balance: args.newBalance })

      return { newBalance: args.newBalance, difference }
    }),
})

// Private mutation to cleanup orphaned child references
// Run this if data gets out of sync (e.g., after failed deletions)
export const cleanupOrphanedReferences = internalMutation({
  args: Schema.Struct({}),
  returns: CleanupResult,
  handler: () =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      // Get all valid child IDs
      const children = yield* db.query('children').collect()
      const validChildIds = new Set(children.map((c) => c._id))

      let cleanedSchedules = 0
      let deletedParticipants = 0
      let deletedInstances = 0
      let deletedWithdrawals = 0

      // Clean up scheduledChores.childIds - remove orphaned references
      const allSchedules = yield* db.query('scheduledChores').collect()
      for (const schedule of allSchedules) {
        const validIds = schedule.childIds.filter((id) =>
          validChildIds.has(id)
        )
        if (validIds.length !== schedule.childIds.length) {
          if (validIds.length === 0 && !schedule.isOptional) {
            // Schedule has no valid children and isn't optional - deactivate it
            yield* db.patch(schedule._id, { childIds: validIds, isActive: false })
          } else {
            yield* db.patch(schedule._id, { childIds: validIds })
          }
          cleanedSchedules++
        }
      }

      // Delete choreParticipants with orphaned childId
      const allParticipants = yield* db.query('choreParticipants').collect()
      for (const participant of allParticipants) {
        if (!validChildIds.has(participant.childId )) {
          yield* db.delete(participant._id)
          deletedParticipants++
        }
      }

      // Delete choreInstances with no participants
      const allInstances = yield* db.query('choreInstances').collect()
      for (const instance of allInstances) {
        const hasParticipantsOpt = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .first()
        if (Option.isNone(hasParticipantsOpt)) {
          yield* db.delete(instance._id)
          deletedInstances++
        }
      }

      // Delete withdrawals with orphaned childId
      const allWithdrawals = yield* db.query('withdrawals').collect()
      for (const withdrawal of allWithdrawals) {
        if (!validChildIds.has(withdrawal.childId )) {
          yield* db.delete(withdrawal._id)
          deletedWithdrawals++
        }
      }

      return {
        cleanedSchedules,
        deletedParticipants,
        deletedInstances,
        deletedWithdrawals,
      }
    }),
})
