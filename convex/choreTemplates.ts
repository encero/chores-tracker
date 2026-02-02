import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx, Id } from '@rjdellecese/confect/server'
import { mutation, query } from './confect'
import { TemplateInUseError, TemplateNotFoundError } from './errors'
import type { ConfectDataModel } from './confect'

// Schema definitions
const TemplateSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  defaultReward: Schema.Number,
  icon: Schema.String,
})

const ListArgs = Schema.Struct({
  limit: Schema.optional(Schema.Number),
})

const ListResult = Schema.Struct({
  items: Schema.Array(TemplateSchema),
  hasMore: Schema.Boolean,
  totalCount: Schema.Number,
})

const TemplateIdArgs = Schema.Struct({
  id: Id.Id('choreTemplates'),
})

const CreateTemplateArgs = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  defaultReward: Schema.Number,
  icon: Schema.String,
})

const CreateTemplateResult = Schema.Struct({
  id: Id.Id('choreTemplates'),
})

const UpdateTemplateArgs = Schema.Struct({
  id: Id.Id('choreTemplates'),
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  defaultReward: Schema.optional(Schema.Number),
  icon: Schema.optional(Schema.String),
})

const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

// List all chore templates
export const list = query({
  args: ListArgs,
  returns: ListResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 50

      const templates = yield* db.query('choreTemplates').collect()

      return {
        items: templates.slice(0, limit).map((t) => ({
          _id: t._id as string,
          _creationTime: t._creationTime,
          name: t.name,
          description: t.description,
          defaultReward: t.defaultReward,
          icon: t.icon,
        })),
        hasMore: templates.length > limit,
        totalCount: templates.length,
      }
    }),
})

// Get single template by ID
export const get = query({
  args: TemplateIdArgs,
  returns: Schema.NullOr(TemplateSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const templateOpt = yield* db.get(args.id)
      if (Option.isNone(templateOpt)) {
        return null
      }
      const t = templateOpt.value
      return {
        _id: t._id as string,
        _creationTime: t._creationTime,
        name: t.name,
        description: t.description,
        defaultReward: t.defaultReward,
        icon: t.icon,
      }
    }),
})

// Create a new chore template
export const create = mutation({
  args: CreateTemplateArgs,
  returns: CreateTemplateResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const id = yield* db.insert('choreTemplates', {
        name: args.name,
        description: args.description,
        defaultReward: args.defaultReward,
        icon: args.icon,
      })

      return { id }
    }),
})

// Update a chore template
export const update = mutation({
  args: UpdateTemplateArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const templateOpt = yield* db.get(args.id)
      if (Option.isNone(templateOpt)) {
        return yield* Effect.fail(new TemplateNotFoundError({ templateId: args.id }))
      }

      const updates: Record<string, string | number | undefined> = {}
      if (args.name !== undefined) {
        updates.name = args.name
      }
      if (args.description !== undefined) {
        updates.description = args.description
      }
      if (args.defaultReward !== undefined) {
        updates.defaultReward = args.defaultReward
      }
      if (args.icon !== undefined) {
        updates.icon = args.icon
      }

      yield* db.patch(args.id, updates)

      return { success: true }
    }),
})

// Delete a chore template
export const remove = mutation({
  args: TemplateIdArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const templateOpt = yield* db.get(args.id)
      if (Option.isNone(templateOpt)) {
        return yield* Effect.fail(new TemplateNotFoundError({ templateId: args.id }))
      }

      // Check if any scheduled chores use this template
      const schedules = yield* db
        .query('scheduledChores')
        .withIndex('by_template', (q) => q.eq('choreTemplateId', args.id))
        .collect()

      if (schedules.length > 0) {
        return yield* Effect.fail(
          new TemplateInUseError({ templateId: args.id, scheduleCount: schedules.length })
        )
      }

      yield* db.delete(args.id)

      return { success: true }
    }),
})
