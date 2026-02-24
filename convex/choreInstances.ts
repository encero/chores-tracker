import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx, Id } from '@rjdellecese/confect/server'
import { mutation, query } from './confect'
import {
  ChoreAlreadyDoneError,
  ChoreInstanceNotFoundError,
  ChoreNotDoneError,
  ChoreNotPendingError,
  EffortPercentTotalError,
  NotAllParticipantsDoneError,
  NotJoinedChoreError,
  ParticipantAlreadyRatedError,
  ParticipantNotFoundError,
  ScheduledChoreNotFoundError,
} from './errors'
import type { ConfectDataModel } from './confect'
import type { QualityRating } from './schema'

const QUALITY_COEFFICIENTS: Record<QualityRating, number> = {
  failed: 0,
  bad: 0.5,
  good: 1.0,
  excellent: 1.25,
}

// Schema definitions
const QualityRatingSchema = Schema.Union(
  Schema.Literal('failed'),
  Schema.Literal('bad'),
  Schema.Literal('good'),
  Schema.Literal('excellent')
)

const ChoreInstanceStatusSchema = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('completed'),
  Schema.Literal('missed')
)

const ParticipantStatusSchema = Schema.Union(Schema.Literal('pending'), Schema.Literal('done'))

const ChildSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  avatarEmoji: Schema.String,
  accessCode: Schema.String,
  balance: Schema.Number,
})

const TemplateSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  defaultReward: Schema.Number,
  icon: Schema.String,
})

const ScheduleSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  childIds: Schema.Array(Id.Id('children')),
  choreTemplateId: Id.Id('choreTemplates'),
  reward: Schema.Number,
  isJoined: Schema.Boolean,
  isOptional: Schema.Boolean,
})

const ParticipantSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  choreInstanceId: Id.Id('choreInstances'),
  childId: Id.Id('children'),
  status: ParticipantStatusSchema,
  completedAt: Schema.optional(Schema.Number),
  effortPercent: Schema.optional(Schema.Number),
  earnedReward: Schema.optional(Schema.Number),
  quality: Schema.optional(QualityRatingSchema),
  child: Schema.NullOr(ChildSchema),
})

const EnrichedInstanceSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  scheduledChoreId: Id.Id('scheduledChores'),
  dueDate: Schema.String,
  isJoined: Schema.Boolean,
  status: ChoreInstanceStatusSchema,
  completedAt: Schema.optional(Schema.Number),
  quality: Schema.optional(QualityRatingSchema),
  totalReward: Schema.Number,
  notes: Schema.optional(Schema.String),
  template: Schema.NullOr(TemplateSchema),
  schedule: Schema.NullOr(ScheduleSchema),
  participants: Schema.Array(ParticipantSchema),
})

const ForReviewInstanceSchema = Schema.extend(
  EnrichedInstanceSchema,
  Schema.Struct({
    doneCount: Schema.Number,
    totalCount: Schema.Number,
    allDone: Schema.Boolean,
  })
)

const ChildInstanceSchema = Schema.extend(
  EnrichedInstanceSchema,
  Schema.Struct({
    myParticipation: Schema.Struct({
      _id: Schema.String,
      _creationTime: Schema.Number,
      choreInstanceId: Id.Id('choreInstances'),
      childId: Id.Id('children'),
      status: ParticipantStatusSchema,
      completedAt: Schema.optional(Schema.Number),
      effortPercent: Schema.optional(Schema.Number),
      earnedReward: Schema.optional(Schema.Number),
      quality: Schema.optional(QualityRatingSchema),
    }),
  })
)

// Args schemas
const GetTodayArgs = Schema.Struct({
  childId: Schema.optional(Id.Id('children')),
})

const GetForChildArgs = Schema.Struct({
  childId: Id.Id('children'),
  startDate: Schema.optional(Schema.String),
  endDate: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.Number),
  status: Schema.optional(ChoreInstanceStatusSchema),
})

const GetForReviewArgs = Schema.Struct({
  limit: Schema.optional(Schema.Number),
})

const GetHistoryArgs = Schema.Struct({
  childId: Schema.optional(Id.Id('children')),
  limit: Schema.optional(Schema.Number),
})

const MarkDoneArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
  childId: Id.Id('children'),
})

const RateArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
  quality: QualityRatingSchema,
  notes: Schema.optional(Schema.String),
})

const RateJoinedArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
  quality: QualityRatingSchema,
  efforts: Schema.Array(
    Schema.Struct({
      childId: Id.Id('children'),
      effortPercent: Schema.Number,
    })
  ),
  notes: Schema.optional(Schema.String),
  forceComplete: Schema.optional(Schema.Boolean),
})

const RateParticipantArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
  childId: Id.Id('children'),
  quality: QualityRatingSchema,
  effortPercent: Schema.optional(Schema.Number),
})

const RateAllParticipantsArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
  ratings: Schema.Array(
    Schema.Struct({
      childId: Id.Id('children'),
      quality: QualityRatingSchema,
      effortPercent: Schema.optional(Schema.Number),
    })
  ),
  notes: Schema.optional(Schema.String),
})

const CreateInstanceArgs = Schema.Struct({
  scheduledChoreId: Id.Id('scheduledChores'),
  dueDate: Schema.String,
})

const InstanceIdArgs = Schema.Struct({
  instanceId: Id.Id('choreInstances'),
})

// Result schemas
const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

const RateParticipantResult = Schema.Struct({
  success: Schema.Boolean,
  allRated: Schema.Boolean,
  earnedReward: Schema.Number,
})

const CreateResult = Schema.Struct({
  id: Id.Id('choreInstances'),
})

const ForReviewResult = Schema.Struct({
  items: Schema.Array(ForReviewInstanceSchema),
  hasMore: Schema.Boolean,
  totalCount: Schema.Number,
})

// Helper to enrich participant with child data
const enrichParticipant = (
  p: {
    _id: string
    _creationTime: number
    choreInstanceId: string
    childId: string
    status: 'pending' | 'done'
    completedAt?: number
    effortPercent?: number
    earnedReward?: number
    quality?: QualityRating
  },
  child: { _id: string; _creationTime: number; name: string; avatarEmoji: string; accessCode: string; balance: number } | null
) => ({
  _id: p._id,
  _creationTime: p._creationTime,
  choreInstanceId: p.choreInstanceId as string & { __tableName: 'choreInstances' },
  childId: p.childId as string & { __tableName: 'children' },
  status: p.status,
  completedAt: p.completedAt,
  effortPercent: p.effortPercent,
  earnedReward: p.earnedReward,
  quality: p.quality,
  child,
})

// Get today's chores for all or specific child (includes incomplete chores from past days)
export const getToday = query({
  args: GetTodayArgs,
  returns: Schema.Array(EnrichedInstanceSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const today = new Date().toISOString().split('T')[0]

      // Get today's chores
      const todayInstances = yield* db
        .query('choreInstances')
        .withIndex('by_due_date', (q) => q.eq('dueDate', today))
        .collect()

      // Get all pending chores from past days
      const pendingInstances = yield* db
        .query('choreInstances')
        .withIndex('by_status', (q) => q.eq('status', 'pending'))
        .filter((q) => q.lt(q.field('dueDate'), today))
        .collect()

      // Combine and deduplicate
      const instanceMap = new Map<string, (typeof todayInstances)[0]>()
      for (const instance of [...todayInstances, ...pendingInstances]) {
        instanceMap.set(instance._id as string, instance)
      }
      const instances = Array.from(instanceMap.values())

      // Get participants and filter by child if specified
      const enriched: Array<Schema.Schema.Type<typeof EnrichedInstanceSchema>> = []

      for (const instance of instances) {
        const participants = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        // If filtering by child, check if they're a participant
        if (args.childId) {
          const isParticipant = participants.some((p) => p.childId === args.childId)
          if (!isParticipant) continue
        }

        const scheduleOpt = yield* db.get(instance.scheduledChoreId)
        const schedule = Option.isSome(scheduleOpt)
          ? {
              _id: scheduleOpt.value._id as string,
              _creationTime: scheduleOpt.value._creationTime,
              childIds: scheduleOpt.value.childIds,
              choreTemplateId: scheduleOpt.value.choreTemplateId,
              reward: scheduleOpt.value.reward,
              isJoined: scheduleOpt.value.isJoined,
              isOptional: scheduleOpt.value.isOptional,
            }
          : null

        const templateOpt =
          schedule ? yield* db.get(schedule.choreTemplateId) : Option.none()
        const template = Option.isSome(templateOpt)
          ? {
              _id: templateOpt.value._id as string,
              _creationTime: templateOpt.value._creationTime,
              name: templateOpt.value.name,
              description: templateOpt.value.description,
              defaultReward: templateOpt.value.defaultReward,
              icon: templateOpt.value.icon,
            }
          : null

        // Get children data for participants
        const enrichedParticipants = yield* Effect.all(
          participants.map((p) =>
            Effect.gen(function* () {
              const childOpt = yield* db.get(p.childId)
              const child = Option.isSome(childOpt)
                ? {
                    _id: childOpt.value._id as string,
                    _creationTime: childOpt.value._creationTime,
                    name: childOpt.value.name,
                    avatarEmoji: childOpt.value.avatarEmoji,
                    accessCode: childOpt.value.accessCode,
                    balance: childOpt.value.balance,
                  }
                : null
              return enrichParticipant(
                {
                  _id: p._id as string,
                  _creationTime: p._creationTime,
                  choreInstanceId: p.choreInstanceId as string,
                  childId: p.childId as string,
                  status: p.status,
                  completedAt: p.completedAt,
                  effortPercent: p.effortPercent,
                  earnedReward: p.earnedReward,
                  quality: p.quality,
                },
                child
              )
            })
          )
        )

        enriched.push({
          _id: instance._id as string,
          _creationTime: instance._creationTime,
          scheduledChoreId: instance.scheduledChoreId,
          dueDate: instance.dueDate,
          isJoined: instance.isJoined,
          status: instance.status,
          completedAt: instance.completedAt,
          quality: instance.quality,
          totalReward: instance.totalReward,
          notes: instance.notes,
          template,
          schedule,
          participants: enrichedParticipants,
        })
      }

      return enriched
    }),
})

// Get chores for a specific child
export const getForChild = query({
  args: GetForChildArgs,
  returns: Schema.Array(ChildInstanceSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 100

      // Get all participant records for this child
      const participations = yield* db
        .query('choreParticipants')
        .withIndex('by_child', (q) => q.eq('childId', args.childId))
        .collect()

      const instances: Array<Schema.Schema.Type<typeof ChildInstanceSchema>> = []

      for (const p of participations) {
        const instanceOpt = yield* db.get(p.choreInstanceId)
        if (Option.isNone(instanceOpt)) continue

        const instance = instanceOpt.value

        // Filter by date range
        if (args.startDate && instance.dueDate < args.startDate) continue
        if (args.endDate && instance.dueDate > args.endDate) continue

        // Filter by status if specified
        if (args.status && instance.status !== args.status) continue

        const scheduleOpt = yield* db.get(instance.scheduledChoreId)
        const schedule = Option.isSome(scheduleOpt)
          ? {
              _id: scheduleOpt.value._id as string,
              _creationTime: scheduleOpt.value._creationTime,
              childIds: scheduleOpt.value.childIds,
              choreTemplateId: scheduleOpt.value.choreTemplateId,
              reward: scheduleOpt.value.reward,
              isJoined: scheduleOpt.value.isJoined,
              isOptional: scheduleOpt.value.isOptional,
            }
          : null

        const templateOpt =
          schedule ? yield* db.get(schedule.choreTemplateId) : Option.none()
        const template = Option.isSome(templateOpt)
          ? {
              _id: templateOpt.value._id as string,
              _creationTime: templateOpt.value._creationTime,
              name: templateOpt.value.name,
              description: templateOpt.value.description,
              defaultReward: templateOpt.value.defaultReward,
              icon: templateOpt.value.icon,
            }
          : null

        // Get all participants for this instance
        const participants = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        const enrichedParticipants = yield* Effect.all(
          participants.map((part) =>
            Effect.gen(function* () {
              const childOpt = yield* db.get(part.childId)
              const child = Option.isSome(childOpt)
                ? {
                    _id: childOpt.value._id as string,
                    _creationTime: childOpt.value._creationTime,
                    name: childOpt.value.name,
                    avatarEmoji: childOpt.value.avatarEmoji,
                    accessCode: childOpt.value.accessCode,
                    balance: childOpt.value.balance,
                  }
                : null
              return enrichParticipant(
                {
                  _id: part._id as string,
                  _creationTime: part._creationTime,
                  choreInstanceId: part.choreInstanceId as string,
                  childId: part.childId as string,
                  status: part.status,
                  completedAt: part.completedAt,
                  effortPercent: part.effortPercent,
                  earnedReward: part.earnedReward,
                  quality: part.quality,
                },
                child
              )
            })
          )
        )

        instances.push({
          _id: instance._id as string,
          _creationTime: instance._creationTime,
          scheduledChoreId: instance.scheduledChoreId,
          dueDate: instance.dueDate,
          isJoined: instance.isJoined,
          status: instance.status,
          completedAt: instance.completedAt,
          quality: instance.quality,
          totalReward: instance.totalReward,
          notes: instance.notes,
          template,
          schedule,
          participants: enrichedParticipants,
          myParticipation: {
            _id: p._id as string,
            _creationTime: p._creationTime,
            choreInstanceId: p.choreInstanceId,
            childId: p.childId,
            status: p.status,
            completedAt: p.completedAt,
            effortPercent: p.effortPercent,
            earnedReward: p.earnedReward,
            quality: p.quality,
          },
        })
      }

      // Sort by due date descending and apply limit
      instances.sort((a, b) => b.dueDate.localeCompare(a.dueDate))

      return instances.slice(0, limit)
    }),
})

// Get chores awaiting review
export const getForReview = query({
  args: GetForReviewArgs,
  returns: ForReviewResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 20

      // Get pending instances
      const instances = yield* db
        .query('choreInstances')
        .withIndex('by_status', (q) => q.eq('status', 'pending'))
        .collect()

      const forReview: Array<Schema.Schema.Type<typeof ForReviewInstanceSchema>> = []

      for (const instance of instances) {
        if (instance.quality) continue // Already rated

        const participants = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        // Check if any work is done
        const doneCount = participants.filter((p) => p.status === 'done').length
        if (doneCount === 0) continue

        const allDone = doneCount === participants.length

        const scheduleOpt = yield* db.get(instance.scheduledChoreId)
        const schedule = Option.isSome(scheduleOpt)
          ? {
              _id: scheduleOpt.value._id as string,
              _creationTime: scheduleOpt.value._creationTime,
              childIds: scheduleOpt.value.childIds,
              choreTemplateId: scheduleOpt.value.choreTemplateId,
              reward: scheduleOpt.value.reward,
              isJoined: scheduleOpt.value.isJoined,
              isOptional: scheduleOpt.value.isOptional,
            }
          : null

        const templateOpt =
          schedule ? yield* db.get(schedule.choreTemplateId) : Option.none()
        const template = Option.isSome(templateOpt)
          ? {
              _id: templateOpt.value._id as string,
              _creationTime: templateOpt.value._creationTime,
              name: templateOpt.value.name,
              description: templateOpt.value.description,
              defaultReward: templateOpt.value.defaultReward,
              icon: templateOpt.value.icon,
            }
          : null

        const enrichedParticipants = yield* Effect.all(
          participants.map((p) =>
            Effect.gen(function* () {
              const childOpt = yield* db.get(p.childId)
              const child = Option.isSome(childOpt)
                ? {
                    _id: childOpt.value._id as string,
                    _creationTime: childOpt.value._creationTime,
                    name: childOpt.value.name,
                    avatarEmoji: childOpt.value.avatarEmoji,
                    accessCode: childOpt.value.accessCode,
                    balance: childOpt.value.balance,
                  }
                : null
              return enrichParticipant(
                {
                  _id: p._id as string,
                  _creationTime: p._creationTime,
                  choreInstanceId: p.choreInstanceId as string,
                  childId: p.childId as string,
                  status: p.status,
                  completedAt: p.completedAt,
                  effortPercent: p.effortPercent,
                  earnedReward: p.earnedReward,
                  quality: p.quality,
                },
                child
              )
            })
          )
        )

        forReview.push({
          _id: instance._id as string,
          _creationTime: instance._creationTime,
          scheduledChoreId: instance.scheduledChoreId,
          dueDate: instance.dueDate,
          isJoined: instance.isJoined,
          status: instance.status,
          completedAt: instance.completedAt,
          quality: instance.quality,
          totalReward: instance.totalReward,
          notes: instance.notes,
          template,
          schedule,
          participants: enrichedParticipants,
          doneCount,
          totalCount: participants.length,
          allDone,
        })
      }

      // Sort by due date ascending (oldest first - most urgent)
      forReview.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      return {
        items: forReview.slice(0, limit),
        hasMore: forReview.length > limit,
        totalCount: forReview.length,
      }
    }),
})

// Get chore history with pagination
export const getHistory = query({
  args: GetHistoryArgs,
  returns: Schema.Array(EnrichedInstanceSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 50

      let instances = yield* db
        .query('choreInstances')
        .withIndex('by_status', (q) => q.eq('status', 'completed'))
        .order('desc')
        .take(limit * 2) // Take extra to account for filtering

      // If filtering by child, we need to check participants
      if (args.childId) {
        const filtered: typeof instances = []
        for (const instance of instances) {
          const participants = yield* db
            .query('choreParticipants')
            .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
            .collect()

          const isParticipant = participants.some((p) => p.childId === args.childId)
          if (isParticipant) {
            filtered.push(instance)
          }
        }
        instances = filtered
      }

      instances = instances.slice(0, limit)

      // Enrich with data
      const enriched = yield* Effect.all(
        instances.map((instance) =>
          Effect.gen(function* () {
            const scheduleOpt = yield* db.get(instance.scheduledChoreId)
            const schedule = Option.isSome(scheduleOpt)
              ? {
                  _id: scheduleOpt.value._id as string,
                  _creationTime: scheduleOpt.value._creationTime,
                  childIds: scheduleOpt.value.childIds,
                  choreTemplateId: scheduleOpt.value.choreTemplateId,
                  reward: scheduleOpt.value.reward,
                  isJoined: scheduleOpt.value.isJoined,
                  isOptional: scheduleOpt.value.isOptional,
                }
              : null

            const templateOpt =
              schedule ? yield* db.get(schedule.choreTemplateId) : Option.none()
            const template = Option.isSome(templateOpt)
              ? {
                  _id: templateOpt.value._id as string,
                  _creationTime: templateOpt.value._creationTime,
                  name: templateOpt.value.name,
                  description: templateOpt.value.description,
                  defaultReward: templateOpt.value.defaultReward,
                  icon: templateOpt.value.icon,
                }
              : null

            const participants = yield* db
              .query('choreParticipants')
              .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
              .collect()

            const enrichedParticipants = yield* Effect.all(
              participants.map((p) =>
                Effect.gen(function* () {
                  const childOpt = yield* db.get(p.childId)
                  const child = Option.isSome(childOpt)
                    ? {
                        _id: childOpt.value._id as string,
                        _creationTime: childOpt.value._creationTime,
                        name: childOpt.value.name,
                        avatarEmoji: childOpt.value.avatarEmoji,
                        accessCode: childOpt.value.accessCode,
                        balance: childOpt.value.balance,
                      }
                    : null
                  return enrichParticipant(
                    {
                      _id: p._id as string,
                      _creationTime: p._creationTime,
                      choreInstanceId: p.choreInstanceId as string,
                      childId: p.childId as string,
                      status: p.status,
                      completedAt: p.completedAt,
                      effortPercent: p.effortPercent,
                      earnedReward: p.earnedReward,
                      quality: p.quality,
                    },
                    child
                  )
                })
              )
            )

            return {
              _id: instance._id as string,
              _creationTime: instance._creationTime,
              scheduledChoreId: instance.scheduledChoreId,
              dueDate: instance.dueDate,
              isJoined: instance.isJoined,
              status: instance.status,
              completedAt: instance.completedAt,
              quality: instance.quality,
              totalReward: instance.totalReward,
              notes: instance.notes,
              template,
              schedule,
              participants: enrichedParticipants,
            }
          })
        )
      )

      return enriched
    }),
})

// Mark individual child's part as done
export const markDone = mutation({
  args: MarkDoneArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      // Find participant record
      const participantOpt = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .filter((q) => q.eq(q.field('childId'), args.childId))
        .first()

      if (Option.isNone(participantOpt)) {
        return yield* Effect.fail(
          new ParticipantNotFoundError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      const participant = participantOpt.value

      if (participant.status === 'done') {
        return yield* Effect.fail(
          new ChoreAlreadyDoneError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      yield* db.patch(participant._id, {
        status: 'done',
        completedAt: Date.now(),
      })

      return { success: true }
    }),
})

// Unmark a child's part as done (reset to pending) - only available before review
export const unmarkDone = mutation({
  args: MarkDoneArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      // Find participant record
      const participantOpt = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .filter((q) => q.eq(q.field('childId'), args.childId))
        .first()

      if (Option.isNone(participantOpt)) {
        return yield* Effect.fail(
          new ParticipantNotFoundError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      const participant = participantOpt.value

      if (participant.status !== 'done') {
        return yield* Effect.fail(
          new ChoreNotDoneError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      if (participant.quality) {
        return yield* Effect.fail(
          new ParticipantAlreadyRatedError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      yield* db.patch(participant._id, {
        status: 'pending',
        completedAt: undefined,
      })

      return { success: true }
    }),
})

// Rate a chore (for individual chores)
export const rate = mutation({
  args: RateArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      const participants = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .collect()

      if (participants.length === 0) {
        return yield* Effect.fail(
          new ParticipantNotFoundError({ childId: 'none', instanceId: args.instanceId })
        )
      }

      // For individual chores (1 participant)
      if (!instance.isJoined) {
        const participant = participants[0]
        const coefficient = QUALITY_COEFFICIENTS[args.quality]
        const earnedReward = Math.round(instance.totalReward * coefficient)

        // Update participant
        yield* db.patch(participant._id, {
          effortPercent: 100,
          earnedReward,
        })

        // Update child balance
        const childOpt = yield* db.get(participant.childId)
        if (Option.isSome(childOpt)) {
          yield* db.patch(participant.childId, {
            balance: childOpt.value.balance + earnedReward,
          })
        }
      } else {
        // For joined chores, use equal split by default
        const equalPercent = 100 / participants.length
        const coefficient = QUALITY_COEFFICIENTS[args.quality]

        for (const participant of participants) {
          const earnedReward = Math.round(
            instance.totalReward * (equalPercent / 100) * coefficient
          )

          yield* db.patch(participant._id, {
            effortPercent: equalPercent,
            earnedReward,
          })

          // Update child balance
          const childOpt = yield* db.get(participant.childId)
          if (Option.isSome(childOpt)) {
            yield* db.patch(participant.childId, {
              balance: childOpt.value.balance + earnedReward,
            })
          }
        }
      }

      // Update instance
      yield* db.patch(args.instanceId, {
        status: 'completed',
        quality: args.quality,
        completedAt: Date.now(),
        notes: args.notes,
      })

      return { success: true }
    }),
})

// Rate joined chore with custom effort split
export const rateJoined = mutation({
  args: RateJoinedArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (!instance.isJoined) {
        return yield* Effect.fail(new NotJoinedChoreError({ instanceId: args.instanceId }))
      }

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      // Check if all participants are done
      const participants = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .collect()

      const allDone = participants.every((p) => p.status === 'done')
      if (!allDone && !args.forceComplete) {
        const doneCount = participants.filter((p) => p.status === 'done').length
        return yield* Effect.fail(
          new NotAllParticipantsDoneError({
            instanceId: args.instanceId,
            doneCount,
            totalCount: participants.length,
          })
        )
      }

      // Validate effort totals 100%
      const totalEffort = args.efforts.reduce((sum, e) => sum + e.effortPercent, 0)
      if (Math.abs(totalEffort - 100) > 0.01) {
        return yield* Effect.fail(new EffortPercentTotalError({ total: totalEffort }))
      }

      const coefficient = QUALITY_COEFFICIENTS[args.quality]

      for (const effort of args.efforts) {
        const participantOpt = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
          .filter((q) => q.eq(q.field('childId'), effort.childId))
          .first()

        if (Option.isNone(participantOpt)) {
          return yield* Effect.fail(
            new ParticipantNotFoundError({
              childId: effort.childId,
              instanceId: args.instanceId,
            })
          )
        }

        const participant = participantOpt.value
        const earnedReward = Math.round(
          instance.totalReward * (effort.effortPercent / 100) * coefficient
        )

        yield* db.patch(participant._id, {
          effortPercent: effort.effortPercent,
          earnedReward,
        })

        // Update child balance
        const childOpt = yield* db.get(effort.childId)
        if (Option.isSome(childOpt)) {
          yield* db.patch(effort.childId, {
            balance: childOpt.value.balance + earnedReward,
          })
        }
      }

      // Update instance
      yield* db.patch(args.instanceId, {
        status: 'completed',
        quality: args.quality,
        completedAt: Date.now(),
        notes: args.notes,
      })

      return { success: true }
    }),
})

// Rate a single participant in any multi-kid chore individually
export const rateParticipant = mutation({
  args: RateParticipantArgs,
  returns: RateParticipantResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      // Find the participant
      const participantOpt = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .filter((q) => q.eq(q.field('childId'), args.childId))
        .first()

      if (Option.isNone(participantOpt)) {
        return yield* Effect.fail(
          new ParticipantNotFoundError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      const participant = participantOpt.value

      if (participant.quality) {
        return yield* Effect.fail(
          new ParticipantAlreadyRatedError({ childId: args.childId, instanceId: args.instanceId })
        )
      }

      // Get all participants to calculate share
      const allParticipants = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .collect()

      const numParticipants = allParticipants.length
      const coefficient = QUALITY_COEFFICIENTS[args.quality]

      let earnedReward: number
      let effortPercent: number

      if (instance.isJoined) {
        // Joined chore: reward is pooled and split by effort
        effortPercent = args.effortPercent ?? 100 / numParticipants
        const baseReward = instance.totalReward * (effortPercent / 100)
        earnedReward = Math.round(baseReward * coefficient)
      } else {
        // Non-joined multi-kid chore: each kid gets full reward
        effortPercent = 100
        earnedReward = Math.round(instance.totalReward * coefficient)
      }

      // Update participant with quality and reward
      yield* db.patch(participant._id, {
        quality: args.quality,
        effortPercent,
        earnedReward,
      })

      // Update child balance
      const childOpt = yield* db.get(args.childId)
      if (Option.isSome(childOpt)) {
        yield* db.patch(args.childId, {
          balance: childOpt.value.balance + earnedReward,
        })
      }

      // Check if all participants have been rated
      const updatedParticipants = yield* db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .collect()

      const allRated = updatedParticipants.every((p) => p.quality)

      if (allRated) {
        // Mark the instance as completed
        yield* db.patch(args.instanceId, {
          status: 'completed',
          completedAt: Date.now(),
        })
      }

      return { success: true, allRated, earnedReward }
    }),
})

// Rate all participants at once with individual qualities
export const rateAllParticipants = mutation({
  args: RateAllParticipantsArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      // For joined chores, validate effort totals 100%
      if (instance.isJoined) {
        const totalEffort = args.ratings.reduce((sum, r) => sum + (r.effortPercent ?? 0), 0)
        if (Math.abs(totalEffort - 100) > 0.01) {
          return yield* Effect.fail(new EffortPercentTotalError({ total: totalEffort }))
        }
      }

      // Process each rating
      for (const rating of args.ratings) {
        const participantOpt = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
          .filter((q) => q.eq(q.field('childId'), rating.childId))
          .first()

        if (Option.isNone(participantOpt)) {
          return yield* Effect.fail(
            new ParticipantNotFoundError({
              childId: rating.childId,
              instanceId: args.instanceId,
            })
          )
        }

        const participant = participantOpt.value
        const coefficient = QUALITY_COEFFICIENTS[rating.quality]
        let earnedReward: number
        let effortPercent: number

        if (instance.isJoined) {
          // Joined chore: reward is pooled and split by effort
          effortPercent = rating.effortPercent ?? 100 / args.ratings.length
          const baseReward = instance.totalReward * (effortPercent / 100)
          earnedReward = Math.round(baseReward * coefficient)
        } else {
          // Non-joined multi-kid chore: each kid gets full reward
          effortPercent = 100
          earnedReward = Math.round(instance.totalReward * coefficient)
        }

        // Update participant
        yield* db.patch(participant._id, {
          quality: rating.quality,
          effortPercent,
          earnedReward,
        })

        // Update child balance
        const childOpt = yield* db.get(rating.childId)
        if (Option.isSome(childOpt)) {
          yield* db.patch(rating.childId, {
            balance: childOpt.value.balance + earnedReward,
          })
        }
      }

      // Mark instance as completed
      yield* db.patch(args.instanceId, {
        status: 'completed',
        completedAt: Date.now(),
        notes: args.notes,
      })

      return { success: true }
    }),
})

// Mark chore as missed
export const markMissed = mutation({
  args: InstanceIdArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const instanceOpt = yield* db.get(args.instanceId)
      if (Option.isNone(instanceOpt)) {
        return yield* Effect.fail(new ChoreInstanceNotFoundError({ instanceId: args.instanceId }))
      }

      const instance = instanceOpt.value

      if (instance.status !== 'pending') {
        return yield* Effect.fail(
          new ChoreNotPendingError({ instanceId: args.instanceId, status: instance.status })
        )
      }

      yield* db.patch(args.instanceId, {
        status: 'missed',
      })

      return { success: true }
    }),
})

// Create a chore instance (used by scheduler or manually)
export const create = mutation({
  args: CreateInstanceArgs,
  returns: CreateResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const scheduleOpt = yield* db.get(args.scheduledChoreId)
      if (Option.isNone(scheduleOpt)) {
        return yield* Effect.fail(
          new ScheduledChoreNotFoundError({ scheduleId: args.scheduledChoreId })
        )
      }

      const schedule = scheduleOpt.value

      // Create instance
      const instanceId = yield* db.insert('choreInstances', {
        scheduledChoreId: args.scheduledChoreId,
        dueDate: args.dueDate,
        isJoined: schedule.isJoined,
        status: 'pending',
        totalReward: schedule.reward,
      })

      // Create participant records
      for (const childId of schedule.childIds) {
        yield* db.insert('choreParticipants', {
          choreInstanceId: instanceId,
          childId,
          status: 'pending',
        })
      }

      return { id: instanceId }
    }),
})
