import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

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
    scheduleType: 'once' | 'daily' | 'weekly' | 'custom'
    scheduleDays?: number[]
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
    case 'weekly':
      // Weekly chores happen on the start date's day of week
      const startDay = getDayOfWeek(schedule.startDate)
      return dayOfWeek === startDay
    case 'custom':
      return schedule.scheduleDays?.includes(dayOfWeek) ?? false
    case 'once':
      return schedule.startDate === date
    default:
      return false
  }
}

// List all scheduled chores
export const list = query({
  args: {
    childId: v.optional(v.id('children')),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let schedules = await ctx.db.query('scheduledChores').collect()

    // Filter by child if specified
    if (args.childId) {
      schedules = schedules.filter((s) => s.childIds.includes(args.childId!))
    }

    // Filter by active status if specified
    if (args.activeOnly) {
      schedules = schedules.filter((s) => s.isActive)
    }

    // Enrich with template and children data
    const enriched = await Promise.all(
      schedules.map(async (schedule) => {
        const template = await ctx.db.get(schedule.choreTemplateId)
        const children = await Promise.all(
          schedule.childIds.map((id) => ctx.db.get(id))
        )
        return {
          ...schedule,
          template,
          children: children.filter(Boolean),
        }
      })
    )

    return enriched
  },
})

// Get single scheduled chore
export const get = query({
  args: {
    id: v.id('scheduledChores'),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id)
    if (!schedule) return null

    const template = await ctx.db.get(schedule.choreTemplateId)
    const children = await Promise.all(
      schedule.childIds.map((id) => ctx.db.get(id))
    )

    return {
      ...schedule,
      template,
      children: children.filter(Boolean),
    }
  },
})

// Create a new scheduled chore
export const create = mutation({
  args: {
    childIds: v.array(v.id('children')),
    choreTemplateId: v.id('choreTemplates'),
    reward: v.number(),
    isJoined: v.boolean(),
    isOptional: v.optional(v.boolean()),
    maxPickupsPerPeriod: v.optional(v.number()),
    scheduleType: v.union(
      v.literal('once'),
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('custom')
    ),
    scheduleDays: v.optional(v.array(v.number())),
    startDate: v.string(),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Validate children exist
    for (const childId of args.childIds) {
      const child = await ctx.db.get(childId)
      if (!child) {
        throw new Error(`Child ${childId} not found`)
      }
    }

    // Validate template exists
    const template = await ctx.db.get(args.choreTemplateId)
    if (!template) {
      throw new Error('Template not found')
    }

    // Joined chores require multiple children
    if (args.isJoined && args.childIds.length < 2) {
      throw new Error('Joined chores require at least 2 children')
    }

    // Optional chores should have empty childIds (any child can pick up)
    const childIdsToSave = args.isOptional ? [] : args.childIds

    const scheduleId = await ctx.db.insert('scheduledChores', {
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
        // Check if instance already exists for today (shouldn't happen for new schedule, but be safe)
        const existing = await ctx.db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', scheduleId))
          .filter((q) => q.eq(q.field('dueDate'), today))
          .first()

        if (!existing) {
          // Create instance for today
          const instanceId = await ctx.db.insert('choreInstances', {
            scheduledChoreId: scheduleId,
            dueDate: today,
            isJoined: args.isJoined,
            status: 'pending',
            totalReward: args.reward,
          })

          // Create participant records
          for (const childId of childIdsToSave) {
            await ctx.db.insert('choreParticipants', {
              choreInstanceId: instanceId,
              childId,
              status: 'pending',
            })
          }
        }
      }
    }

    return { id: scheduleId }
  },
})

// Update a scheduled chore
export const update = mutation({
  args: {
    id: v.id('scheduledChores'),
    childIds: v.optional(v.array(v.id('children'))),
    reward: v.optional(v.number()),
    isJoined: v.optional(v.boolean()),
    isOptional: v.optional(v.boolean()),
    maxPickupsPerPeriod: v.optional(v.number()),
    scheduleType: v.optional(
      v.union(
        v.literal('once'),
        v.literal('daily'),
        v.literal('weekly'),
        v.literal('custom')
      )
    ),
    scheduleDays: v.optional(v.array(v.number())),
    endDate: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id)
    if (!schedule) {
      throw new Error('Scheduled chore not found')
    }

    // Validate children if updating
    if (args.childIds) {
      for (const childId of args.childIds) {
        const child = await ctx.db.get(childId)
        if (!child) {
          throw new Error(`Child ${childId} not found`)
        }
      }
    }

    const updates: Partial<typeof schedule> = {}
    if (args.childIds !== undefined) updates.childIds = args.childIds
    if (args.reward !== undefined) updates.reward = args.reward
    if (args.isJoined !== undefined) updates.isJoined = args.isJoined
    if (args.isOptional !== undefined) updates.isOptional = args.isOptional
    if (args.maxPickupsPerPeriod !== undefined) updates.maxPickupsPerPeriod = args.maxPickupsPerPeriod
    if (args.scheduleType !== undefined) updates.scheduleType = args.scheduleType
    if (args.scheduleDays !== undefined) updates.scheduleDays = args.scheduleDays
    if (args.endDate !== undefined) updates.endDate = args.endDate
    if (args.isActive !== undefined) updates.isActive = args.isActive

    await ctx.db.patch(args.id, updates)

    return { success: true }
  },
})

// Delete a scheduled chore
export const remove = mutation({
  args: {
    id: v.id('scheduledChores'),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id)
    if (!schedule) {
      throw new Error('Scheduled chore not found')
    }

    // Delete all related instances
    const instances = await ctx.db
      .query('choreInstances')
      .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', args.id))
      .collect()

    for (const instance of instances) {
      // Delete participants for each instance
      const participants = await ctx.db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
        .collect()
      for (const p of participants) {
        await ctx.db.delete(p._id)
      }
      await ctx.db.delete(instance._id)
    }

    await ctx.db.delete(args.id)

    return { success: true }
  },
})

// Toggle active status
export const toggleActive = mutation({
  args: {
    id: v.id('scheduledChores'),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.id)
    if (!schedule) {
      throw new Error('Scheduled chore not found')
    }

    await ctx.db.patch(args.id, { isActive: !schedule.isActive })

    return { isActive: !schedule.isActive }
  },
})

// Manually generate today's instances for all active schedules
// Useful if cron hasn't run yet or for testing
export const generateTodayInstances = mutation({
  args: {},
  handler: async (ctx) => {
    const today = getToday()

    // Get all active schedules
    const schedules = await ctx.db
      .query('scheduledChores')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect()

    let created = 0

    for (const schedule of schedules) {
      if (!shouldCreateInstance(schedule, today)) continue

      // Check if instance already exists for today
      const existing = await ctx.db
        .query('choreInstances')
        .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', schedule._id))
        .filter((q) => q.eq(q.field('dueDate'), today))
        .first()

      if (existing) continue

      // Create instance
      const instanceId = await ctx.db.insert('choreInstances', {
        scheduledChoreId: schedule._id,
        dueDate: today,
        isJoined: schedule.isJoined,
        status: 'pending',
        totalReward: schedule.reward,
      })

      // Create participant records
      for (const childId of schedule.childIds) {
        await ctx.db.insert('choreParticipants', {
          choreInstanceId: instanceId,
          childId,
          status: 'pending',
        })
      }

      created++
    }

    return { created }
  },
})

// Helper to get start of period based on schedule type
function getPeriodStart(scheduleType: 'once' | 'daily' | 'weekly' | 'custom'): string {
  const now = new Date()
  switch (scheduleType) {
    case 'daily':
    case 'once':
    case 'custom':
      return now.toISOString().split('T')[0]
    case 'weekly':
      // Get start of current week (Sunday)
      const day = now.getDay()
      const diff = now.getDate() - day
      const weekStart = new Date(now.setDate(diff))
      return weekStart.toISOString().split('T')[0]
    default:
      return now.toISOString().split('T')[0]
  }
}

// List available optional chores a child can pick up
export const listAvailableOptional = query({
  args: {
    childId: v.id('children'),
  },
  handler: async (ctx, args) => {
    const today = getToday()

    // Get all active optional schedules
    const schedules = await ctx.db
      .query('scheduledChores')
      .withIndex('by_optional', (q) => q.eq('isOptional', true).eq('isActive', true))
      .collect()

    const available = await Promise.all(
      schedules.map(async (schedule) => {
        // Check if schedule is valid for today
        if (schedule.startDate > today) return null
        if (schedule.endDate && schedule.endDate < today) return null

        // Check if this should be available today based on schedule type
        if (!shouldCreateInstance(schedule, today)) return null

        // Check how many times this child has picked up this chore in the current period
        const periodStart = getPeriodStart(schedule.scheduleType)

        // Get all instances of this schedule in current period where this child participated
        const instances = await ctx.db
          .query('choreInstances')
          .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', schedule._id))
          .filter((q) => q.gte(q.field('dueDate'), periodStart))
          .collect()

        // Count how many this child has picked up
        let pickupCount = 0
        for (const instance of instances) {
          const participation = await ctx.db
            .query('choreParticipants')
            .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
            .filter((q) => q.eq(q.field('childId'), args.childId))
            .first()
          if (participation) {
            pickupCount++
          }
        }

        // Check against limit
        if (schedule.maxPickupsPerPeriod !== undefined && pickupCount >= schedule.maxPickupsPerPeriod) {
          return null
        }

        // Get template
        const template = await ctx.db.get(schedule.choreTemplateId)

        return {
          ...schedule,
          template,
          pickupCount,
          maxPickups: schedule.maxPickupsPerPeriod,
        }
      })
    )

    return available.filter(Boolean)
  },
})

// Allow a child to pick up an optional chore
export const pickup = mutation({
  args: {
    scheduledChoreId: v.id('scheduledChores'),
    childId: v.id('children'),
  },
  handler: async (ctx, args) => {
    const today = getToday()

    // Validate child exists
    const child = await ctx.db.get(args.childId)
    if (!child) {
      throw new Error('Child not found')
    }

    // Get the schedule
    const schedule = await ctx.db.get(args.scheduledChoreId)
    if (!schedule) {
      throw new Error('Scheduled chore not found')
    }

    if (!schedule.isOptional) {
      throw new Error('This chore is not optional')
    }

    if (!schedule.isActive) {
      throw new Error('This chore schedule is not active')
    }

    // Check if schedule is valid for today
    if (schedule.startDate > today) {
      throw new Error('This chore is not yet available')
    }
    if (schedule.endDate && schedule.endDate < today) {
      throw new Error('This chore is no longer available')
    }

    // Check if available today based on schedule
    if (!shouldCreateInstance(schedule, today)) {
      throw new Error('This chore is not available today')
    }

    // Check pickup limit
    if (schedule.maxPickupsPerPeriod !== undefined) {
      const periodStart = getPeriodStart(schedule.scheduleType)

      const instances = await ctx.db
        .query('choreInstances')
        .withIndex('by_scheduled_chore', (q) => q.eq('scheduledChoreId', args.scheduledChoreId))
        .filter((q) => q.gte(q.field('dueDate'), periodStart))
        .collect()

      let pickupCount = 0
      for (const instance of instances) {
        const participation = await ctx.db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .filter((q) => q.eq(q.field('childId'), args.childId))
          .first()
        if (participation) {
          pickupCount++
        }
      }

      if (pickupCount >= schedule.maxPickupsPerPeriod) {
        throw new Error(`You've already picked up this chore ${schedule.maxPickupsPerPeriod} time(s) this period`)
      }
    }

    // Create instance for this pickup
    const instanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId: args.scheduledChoreId,
      dueDate: today,
      isJoined: false, // Optional chores are individual
      status: 'pending',
      totalReward: schedule.reward,
    })

    // Create participant record for this child
    await ctx.db.insert('choreParticipants', {
      choreInstanceId: instanceId,
      childId: args.childId,
      status: 'pending',
    })

    return { id: instanceId }
  },
})
