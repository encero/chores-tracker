import { Effect, Option, Schema } from 'effect'
import { ConfectMutationCtx, ConfectQueryCtx, Id } from '@rjdellecese/confect/server'
import { mutation, query } from './confect'
import {
  ChildNotFoundError,
  ChoreNoLongerAvailableError,
  ChoreNotActiveError,
  ChoreNotOptionalError,
  ChoreNotYetAvailableError,
  DailyChoresNotCompleteError,
  JoinedChoreRequiresMultipleChildrenError,
  PickupLimitReachedError,
  ScheduledChoreNotFoundError,
  TemplateNotFoundError,
} from './errors'
import type { GenericId } from 'convex/values'
import type { ConfectDataModel } from './confect'
import type { ScheduleType } from './schema'

// Schema definitions
const ScheduleTypeSchema = Schema.Union(
  Schema.Literal('once'),
  Schema.Literal('daily'),
  Schema.Literal('weekly'),
  Schema.Literal('custom')
)

const TemplateSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  defaultReward: Schema.Number,
  icon: Schema.String,
})

const ChildSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  name: Schema.String,
  avatarEmoji: Schema.String,
  accessCode: Schema.String,
  balance: Schema.Number,
})

const EnrichedScheduledChoreSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  childIds: Schema.Array(Id.Id('children')),
  choreTemplateId: Id.Id('choreTemplates'),
  reward: Schema.Number,
  isJoined: Schema.Boolean,
  isOptional: Schema.Boolean,
  maxPickupsPerPeriod: Schema.optional(Schema.Number),
  scheduleType: ScheduleTypeSchema,
  scheduleDays: Schema.optional(Schema.Array(Schema.Number)),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.String),
  isActive: Schema.Boolean,
  template: Schema.NullOr(TemplateSchema),
  children: Schema.Array(ChildSchema),
})

const AvailableOptionalChoreSchema = Schema.Struct({
  _id: Schema.String,
  _creationTime: Schema.Number,
  childIds: Schema.Array(Id.Id('children')),
  choreTemplateId: Id.Id('choreTemplates'),
  reward: Schema.Number,
  isJoined: Schema.Boolean,
  isOptional: Schema.Boolean,
  maxPickupsPerPeriod: Schema.optional(Schema.Number),
  scheduleType: ScheduleTypeSchema,
  scheduleDays: Schema.optional(Schema.Array(Schema.Number)),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.String),
  isActive: Schema.Boolean,
  template: Schema.NullOr(TemplateSchema),
  pickupCount: Schema.Number,
  maxPickups: Schema.optional(Schema.Number),
})

const ListArgs = Schema.Struct({
  childId: Schema.optional(Id.Id('children')),
  activeOnly: Schema.optional(Schema.Boolean),
  limit: Schema.optional(Schema.Number),
})

const ListResult = Schema.Struct({
  items: Schema.Array(EnrichedScheduledChoreSchema),
  hasMore: Schema.Boolean,
  totalCount: Schema.Number,
})

const ScheduleIdArgs = Schema.Struct({
  id: Id.Id('scheduledChores'),
})

const CreateScheduleArgs = Schema.Struct({
  childIds: Schema.Array(Id.Id('children')),
  choreTemplateId: Id.Id('choreTemplates'),
  reward: Schema.Number,
  isJoined: Schema.Boolean,
  isOptional: Schema.Boolean,
  maxPickupsPerPeriod: Schema.optional(Schema.Number),
  scheduleType: ScheduleTypeSchema,
  scheduleDays: Schema.optional(Schema.Array(Schema.Number)),
  startDate: Schema.String,
  endDate: Schema.optional(Schema.String),
})

const UpdateScheduleArgs = Schema.Struct({
  id: Id.Id('scheduledChores'),
  childIds: Schema.optional(Schema.Array(Id.Id('children'))),
  reward: Schema.optional(Schema.Number),
  isJoined: Schema.optional(Schema.Boolean),
  isOptional: Schema.optional(Schema.Boolean),
  maxPickupsPerPeriod: Schema.optional(Schema.Number),
  scheduleType: Schema.optional(ScheduleTypeSchema),
  scheduleDays: Schema.optional(Schema.Array(Schema.Number)),
  endDate: Schema.optional(Schema.String),
  isActive: Schema.optional(Schema.Boolean),
})

const PickupArgs = Schema.Struct({
  scheduledChoreId: Id.Id('scheduledChores'),
  childId: Id.Id('children'),
})

const SuccessResult = Schema.Struct({
  success: Schema.Boolean,
})

const CreateResult = Schema.Struct({
  id: Id.Id('scheduledChores'),
})

const ToggleActiveResult = Schema.Struct({
  isActive: Schema.Boolean,
})

const GenerateTodayResult = Schema.Struct({
  created: Schema.Number,
})

const PickupResult = Schema.Struct({
  id: Id.Id('choreInstances'),
})

// Helper to get today's date in ISO format
function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Helper to get day of week (0 = Sunday, 1 = Monday, etc.)
function getDayOfWeek(dateStr?: string): number {
  const date = dateStr ? new Date(dateStr) : new Date()
  return date.getDay()
}

// Check if a schedule should have an instance on a given date
function shouldCreateInstance(
  schedule: {
    scheduleType: ScheduleType
    scheduleDays?: ReadonlyArray<number>
    startDate: string
    endDate?: string
  },
  date: string
): boolean {
  // Check date range
  if (schedule.startDate > date) return false
  if (schedule.endDate && schedule.endDate < date) return false

  const dayOfWeek = getDayOfWeek(date)

  switch (schedule.scheduleType) {
    case 'daily':
      return true
    case 'weekly': {
      // Weekly chores happen on the start date's day of week
      const startDay = getDayOfWeek(schedule.startDate)
      return dayOfWeek === startDay
    }
    case 'custom':
      return schedule.scheduleDays?.includes(dayOfWeek) ?? false
    case 'once':
      return schedule.startDate === date
    default:
      return false
  }
}

// Helper to get start of period based on schedule type
function getPeriodStart(scheduleType: ScheduleType): string {
  const now = new Date()
  switch (scheduleType) {
    case 'daily':
    case 'once':
    case 'custom':
      return now.toISOString().split('T')[0]
    case 'weekly': {
      // Get start of current week (Sunday)
      const day = now.getDay()
      const diff = now.getDate() - day
      const weekStart = new Date(now.setDate(diff))
      return weekStart.toISOString().split('T')[0]
    }
    default:
      return now.toISOString().split('T')[0]
  }
}

// List all scheduled chores
export const list = query({
  args: ListArgs,
  returns: ListResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const limit = args.limit ?? 50

      let schedules = yield* db.query('scheduledChores').collect()

      // Filter by child if specified
      if (args.childId) {
        schedules = schedules.filter((s) => s.childIds.includes(args.childId!))
      }

      // Filter by active status if specified
      if (args.activeOnly) {
        schedules = schedules.filter((s) => s.isActive)
      }

      // Enrich with template and children data
      const enriched = yield* Effect.all(
        schedules.map((schedule) =>
          Effect.gen(function* () {
            const templateOpt = yield* db.get(schedule.choreTemplateId)
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

            const childrenResults = yield* Effect.all(
              schedule.childIds.map((id) => db.get(id))
            )
            const children = childrenResults
              .filter((opt) => Option.isSome(opt))
              .map((opt) => {
                const c = opt.value
                return {
                  _id: c._id as string,
                  _creationTime: c._creationTime,
                  name: c.name,
                  avatarEmoji: c.avatarEmoji,
                  accessCode: c.accessCode,
                  balance: c.balance,
                }
              })

            return {
              _id: schedule._id as string,
              _creationTime: schedule._creationTime,
              childIds: schedule.childIds,
              choreTemplateId: schedule.choreTemplateId,
              reward: schedule.reward,
              isJoined: schedule.isJoined,
              isOptional: schedule.isOptional,
              maxPickupsPerPeriod: schedule.maxPickupsPerPeriod,
              scheduleType: schedule.scheduleType,
              scheduleDays: schedule.scheduleDays,
              startDate: schedule.startDate,
              endDate: schedule.endDate,
              isActive: schedule.isActive,
              template,
              children,
            }
          })
        )
      )

      return {
        items: enriched.slice(0, limit),
        hasMore: enriched.length > limit,
        totalCount: enriched.length,
      }
    }),
})

// Get single scheduled chore
export const get = query({
  args: ScheduleIdArgs,
  returns: Schema.NullOr(EnrichedScheduledChoreSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()

      const scheduleOpt = yield* db.get(args.id)
      if (Option.isNone(scheduleOpt)) {
        return null
      }

      const schedule = scheduleOpt.value
      const templateOpt = yield* db.get(schedule.choreTemplateId)
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

      const childrenResults = yield* Effect.all(schedule.childIds.map((id) => db.get(id)))
      const children = childrenResults
        .filter((opt) => Option.isSome(opt))
        .map((opt) => {
          const c = opt.value
          return {
            _id: c._id as string,
            _creationTime: c._creationTime,
            name: c.name,
            avatarEmoji: c.avatarEmoji,
            accessCode: c.accessCode,
            balance: c.balance,
          }
        })

      return {
        _id: schedule._id as string,
        _creationTime: schedule._creationTime,
        childIds: schedule.childIds,
        choreTemplateId: schedule.choreTemplateId,
        reward: schedule.reward,
        isJoined: schedule.isJoined,
        isOptional: schedule.isOptional,
        maxPickupsPerPeriod: schedule.maxPickupsPerPeriod,
        scheduleType: schedule.scheduleType,
        scheduleDays: schedule.scheduleDays,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        isActive: schedule.isActive,
        template,
        children,
      }
    }),
})

// Create a new scheduled chore
export const create = mutation({
  args: CreateScheduleArgs,
  returns: CreateResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      // Validate children exist
      for (const childId of args.childIds) {
        const childOpt = yield* db.get(childId)
        if (Option.isNone(childOpt)) {
          return yield* Effect.fail(new ChildNotFoundError({ childId }))
        }
      }

      // Validate template exists
      const templateOpt = yield* db.get(args.choreTemplateId)
      if (Option.isNone(templateOpt)) {
        return yield* Effect.fail(new TemplateNotFoundError({ templateId: args.choreTemplateId }))
      }

      // Joined chores require multiple children
      if (args.isJoined && args.childIds.length < 2) {
        return yield* Effect.fail(new JoinedChoreRequiresMultipleChildrenError())
      }

      // Optional chores should have empty childIds (any child can pick up)
      const childIdsToSave = args.isOptional ? [] : args.childIds

      const scheduleId = yield* db.insert('scheduledChores', {
        childIds: childIdsToSave,
        choreTemplateId: args.choreTemplateId,
        reward: args.reward,
        isJoined: args.isJoined,
        isOptional: args.isOptional,
        maxPickupsPerPeriod: args.maxPickupsPerPeriod,
        scheduleType: args.scheduleType,
        scheduleDays: args.scheduleDays,
        startDate: args.startDate,
        endDate: args.endDate,
        isActive: true,
      })

      // Check if we should create an instance for today
      // Skip for optional chores - kids pick those up themselves
      if (!args.isOptional) {
        const today = getToday()
        const scheduleData = {
          scheduleType: args.scheduleType,
          scheduleDays: args.scheduleDays,
          startDate: args.startDate,
          endDate: args.endDate,
        }

        if (shouldCreateInstance(scheduleData, today)) {
          // Check if instance already exists for today
          const existing = yield* db
            .query('choreInstances')
            .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', scheduleId))
            .filter((q) => q.eq(q.field('dueDate'), today))
            .first()

          if (Option.isNone(existing)) {
            // Create instance for today
            const instanceId = yield* db.insert('choreInstances', {
              scheduledChoreId: scheduleId,
              dueDate: today,
              isJoined: args.isJoined,
              status: 'pending',
              totalReward: args.reward,
            })

            // Create participant records
            for (const childId of childIdsToSave) {
              yield* db.insert('choreParticipants', {
                choreInstanceId: instanceId,
                childId,
                status: 'pending',
              })
            }
          }
        }
      }

      return { id: scheduleId }
    }),
})

// Update a scheduled chore
export const update = mutation({
  args: UpdateScheduleArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const scheduleOpt = yield* db.get(args.id)
      if (Option.isNone(scheduleOpt)) {
        return yield* Effect.fail(new ScheduledChoreNotFoundError({ scheduleId: args.id }))
      }

      // Validate children if updating
      if (args.childIds) {
        for (const childId of args.childIds) {
          const childOpt = yield* db.get(childId)
          if (Option.isNone(childOpt)) {
            return yield* Effect.fail(new ChildNotFoundError({ childId }))
          }
        }
      }

      const updates: Record<
        string,
        | ReadonlyArray<GenericId<'children'>>
        | number
        | boolean
        | ScheduleType
        | ReadonlyArray<number>
        | string
        | undefined
      > = {}
      if (args.childIds !== undefined) updates.childIds = args.childIds
      if (args.reward !== undefined) updates.reward = args.reward
      if (args.isJoined !== undefined) updates.isJoined = args.isJoined
      if (args.isOptional !== undefined) updates.isOptional = args.isOptional
      if (args.maxPickupsPerPeriod !== undefined)
        updates.maxPickupsPerPeriod = args.maxPickupsPerPeriod
      if (args.scheduleType !== undefined) updates.scheduleType = args.scheduleType
      if (args.scheduleDays !== undefined) updates.scheduleDays = args.scheduleDays
      if (args.endDate !== undefined) updates.endDate = args.endDate
      if (args.isActive !== undefined) updates.isActive = args.isActive

      yield* db.patch(args.id, updates)

      return { success: true }
    }),
})

// Delete a scheduled chore
export const remove = mutation({
  args: ScheduleIdArgs,
  returns: SuccessResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const scheduleOpt = yield* db.get(args.id)
      if (Option.isNone(scheduleOpt)) {
        return yield* Effect.fail(new ScheduledChoreNotFoundError({ scheduleId: args.id }))
      }

      // Delete all related instances
      const instances = yield* db
        .query('choreInstances')
        .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', args.id))
        .collect()

      for (const instance of instances) {
        // Delete participants for each instance
        const participants = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()
        for (const p of participants) {
          yield* db.delete(p._id)
        }
        yield* db.delete(instance._id)
      }

      yield* db.delete(args.id)

      return { success: true }
    }),
})

// Toggle active status
export const toggleActive = mutation({
  args: ScheduleIdArgs,
  returns: ToggleActiveResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()

      const scheduleOpt = yield* db.get(args.id)
      if (Option.isNone(scheduleOpt)) {
        return yield* Effect.fail(new ScheduledChoreNotFoundError({ scheduleId: args.id }))
      }

      const schedule = scheduleOpt.value
      yield* db.patch(args.id, { isActive: !schedule.isActive })

      return { isActive: !schedule.isActive }
    }),
})

// Manually generate today's instances for all active schedules
export const generateTodayInstances = mutation({
  args: Schema.Struct({}),
  returns: GenerateTodayResult,
  handler: () =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()
      const today = getToday()

      // Get all active schedules
      const schedules = yield* db
        .query('scheduledChores')
        .withIndex('by_active', (q) => q.eq('isActive', true))
        .collect()

      let created = 0

      for (const schedule of schedules) {
        if (!shouldCreateInstance(schedule, today)) continue

        // Check if instance already exists for today
        const existing = yield* db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', schedule._id))
          .filter((q) => q.eq(q.field('dueDate'), today))
          .first()

        if (Option.isSome(existing)) continue

        // Create instance
        const instanceId = yield* db.insert('choreInstances', {
          scheduledChoreId: schedule._id,
          dueDate: today,
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

        created++
      }

      return { created }
    }),
})

// List available optional chores a child can pick up
export const listAvailableOptional = query({
  args: Schema.Struct({
    childId: Id.Id('children'),
  }),
  returns: Schema.Array(AvailableOptionalChoreSchema),
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectQueryCtx<ConfectDataModel>()
      const today = getToday()

      // Get all active optional schedules
      const schedules = yield* db
        .query('scheduledChores')
        .withIndex('by_optional', (q) => q.eq('isOptional', true).eq('isActive', true))
        .collect()

      const available: Array<Schema.Schema.Type<typeof AvailableOptionalChoreSchema>> = []

      for (const schedule of schedules) {
        // Check if schedule is valid for today
        if (schedule.startDate > today) continue
        if (schedule.endDate && schedule.endDate < today) continue

        // Check how many times this child has picked up this chore in the current period
        const periodStart = getPeriodStart(schedule.scheduleType)

        // Get all instances of this schedule in current period where this child participated
        const instances = yield* db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', schedule._id))
          .filter((q) => q.gte(q.field('dueDate'), periodStart))
          .collect()

        // Count how many this child has picked up
        let pickupCount = 0
        for (const instance of instances) {
          const participationOpt = yield* db
            .query('choreParticipants')
            .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
            .filter((q) => q.eq(q.field('childId'), args.childId))
            .first()
          if (Option.isSome(participationOpt)) {
            pickupCount++
          }
        }

        // Check against limit
        if (
          schedule.maxPickupsPerPeriod !== undefined &&
          pickupCount >= schedule.maxPickupsPerPeriod
        ) {
          continue
        }

        // Get template
        const templateOpt = yield* db.get(schedule.choreTemplateId)
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

        available.push({
          _id: schedule._id as string,
          _creationTime: schedule._creationTime,
          childIds: schedule.childIds,
          choreTemplateId: schedule.choreTemplateId,
          reward: schedule.reward,
          isJoined: schedule.isJoined,
          isOptional: schedule.isOptional,
          maxPickupsPerPeriod: schedule.maxPickupsPerPeriod,
          scheduleType: schedule.scheduleType,
          scheduleDays: schedule.scheduleDays,
          startDate: schedule.startDate,
          endDate: schedule.endDate,
          isActive: schedule.isActive,
          template,
          pickupCount,
          maxPickups: schedule.maxPickupsPerPeriod,
        })
      }

      return available
    }),
})

// Allow a child to pick up an optional chore
export const pickup = mutation({
  args: PickupArgs,
  returns: PickupResult,
  handler: (args) =>
    Effect.gen(function* () {
      const { db } = yield* ConfectMutationCtx<ConfectDataModel>()
      const today = getToday()

      // Validate child exists
      const childOpt = yield* db.get(args.childId)
      if (Option.isNone(childOpt)) {
        return yield* Effect.fail(new ChildNotFoundError({ childId: args.childId }))
      }

      // Check if child has completed all their daily chores before allowing optional pickup
      const allSchedules = yield* db.query('scheduledChores').collect()
      const childAssignedSchedules = allSchedules.filter(
        (s) => s.isActive && !s.isOptional && s.childIds.includes(args.childId)
      )

      for (const assignedSchedule of childAssignedSchedules) {
        // Check if this schedule should have an instance today
        if (!shouldCreateInstance(assignedSchedule, today)) continue

        // Find today's instance for this schedule
        const instanceOpt = yield* db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', assignedSchedule._id))
          .filter((q) => q.eq(q.field('dueDate'), today))
          .first()

        if (Option.isNone(instanceOpt)) {
          // Instance should exist but doesn't - treat as incomplete
          const templateOpt = yield* db.get(assignedSchedule.choreTemplateId)
          const choreName = Option.isSome(templateOpt)
            ? templateOpt.value.name
            : 'Unknown chore'
          return yield* Effect.fail(new DailyChoresNotCompleteError({ choreName }))
        }

        // Check if this child's participation is marked as done
        const participationOpt = yield* db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instanceOpt.value._id))
          .filter((q) => q.eq(q.field('childId'), args.childId))
          .first()

        if (Option.isNone(participationOpt) || participationOpt.value.status !== 'done') {
          const templateOpt = yield* db.get(assignedSchedule.choreTemplateId)
          const choreName = Option.isSome(templateOpt)
            ? templateOpt.value.name
            : 'Unknown chore'
          return yield* Effect.fail(new DailyChoresNotCompleteError({ choreName }))
        }
      }

      // Get the schedule
      const scheduleOpt = yield* db.get(args.scheduledChoreId)
      if (Option.isNone(scheduleOpt)) {
        return yield* Effect.fail(
          new ScheduledChoreNotFoundError({ scheduleId: args.scheduledChoreId })
        )
      }

      const schedule = scheduleOpt.value

      if (!schedule.isOptional) {
        return yield* Effect.fail(
          new ChoreNotOptionalError({ scheduleId: args.scheduledChoreId })
        )
      }

      if (!schedule.isActive) {
        return yield* Effect.fail(new ChoreNotActiveError({ scheduleId: args.scheduledChoreId }))
      }

      // Check if schedule is valid for today
      if (schedule.startDate > today) {
        return yield* Effect.fail(
          new ChoreNotYetAvailableError({
            scheduleId: args.scheduledChoreId,
            startDate: schedule.startDate,
          })
        )
      }
      if (schedule.endDate && schedule.endDate < today) {
        return yield* Effect.fail(
          new ChoreNoLongerAvailableError({
            scheduleId: args.scheduledChoreId,
            endDate: schedule.endDate,
          })
        )
      }

      // Check pickup limit
      if (schedule.maxPickupsPerPeriod !== undefined) {
        const periodStart = getPeriodStart(schedule.scheduleType)

        const instances = yield* db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', args.scheduledChoreId))
          .filter((q) => q.gte(q.field('dueDate'), periodStart))
          .collect()

        let pickupCount = 0
        for (const instance of instances) {
          const participationOpt = yield* db
            .query('choreParticipants')
            .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
            .filter((q) => q.eq(q.field('childId'), args.childId))
            .first()
          if (Option.isSome(participationOpt)) {
            pickupCount++
          }
        }

        if (pickupCount >= schedule.maxPickupsPerPeriod) {
          return yield* Effect.fail(
            new PickupLimitReachedError({
              scheduleId: args.scheduledChoreId,
              limit: schedule.maxPickupsPerPeriod,
            })
          )
        }
      }

      // Create instance for this pickup
      const instanceId = yield* db.insert('choreInstances', {
        scheduledChoreId: args.scheduledChoreId,
        dueDate: today,
        isJoined: false, // Optional chores are individual
        status: 'pending',
        totalReward: schedule.reward,
      })

      // Create participant record for this child
      yield* db.insert('choreParticipants', {
        choreInstanceId: instanceId,
        childId: args.childId,
        status: 'pending',
      })

      return { id: instanceId }
    }),
})
