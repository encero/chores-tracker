import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx, Id } from '@rjdellecese/confect/server'
import { mutation, query } from './confect'
import { ChildNotFoundError, InsufficientBalanceError, InvalidAmountError } from './errors'
import type { ConfectDataModel } from './confect'

// Schema definitions
const WithdrawalSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  childId: Id.Id('children'),
  amount: Schema.Number,
  createdAt: Schema.Number,
  note: Schema.optional(Schema.String),
})

const ListArgs = Schema.Struct({
  childId: Id.Id('children'),
  limit: Schema.optional(Schema.Number),
})

const CreateArgs = Schema.Struct({
  childId: Id.Id('children'),
  amount: Schema.Number,
  note: Schema.optional(Schema.String),
})

const CreateResult = Schema.Struct({
  id: Id.Id('withdrawals'),
  newBalance: Schema.Number,
})

// List withdrawals for a child
export const list = query({
  args: ListArgs,
  returns: Schema.Array(WithdrawalSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 50

      const withdrawals = yield* db
        .query('withdrawals')
        .withIndex('by_child', (q) => q.eq('childId', args.childId))
        .order('desc')
        .take(limit)

      return withdrawals.map((w) => ({
        _id: w._id as string,
        _creationTime: w._creationTime,
        childId: w.childId,
        amount: w.amount,
        createdAt: w.createdAt,
        note: w.note,
      }))
    }),
})

// Create a withdrawal
export const create = mutation({
  args: CreateArgs,
  returns: CreateResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const childOpt = yield* db.get(args.childId)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.childId }))
      }

      const child = childOpt.value

      if (args.amount <= 0) {
        return yield* Effect.fail(new InvalidAmountError({ amount: args.amount }))
      }

      if (args.amount > child.balance) {
        return yield* Effect.fail(
          new InsufficientBalanceError({ balance: child.balance, requested: args.amount })
        )
      }

      // Create withdrawal record (negative amount)
      const id = yield* db.insert('withdrawals', {
        childId: args.childId,
        amount: -args.amount,
        createdAt: Date.now(),
        note: args.note,
      })

      // Update balance
      const newBalance = child.balance - args.amount
      yield* db.patch(args.childId, {
        balance: newBalance,
      })

      return { id, newBalance }
    }),
})
