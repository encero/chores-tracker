import { v } from 'convex/values'
import { query, mutation } from './_generated/server'
import { Id } from './_generated/dataModel'

const QUALITY_COEFFICIENTS = {
  bad: 0.5,
  good: 1.0,
  excellent: 1.25,
}

// Get today's chores for all or specific child
export const getToday = query({
  args: {
    childId: v.optional(v.id('children')),
  },
  handler: async (ctx, args) => {
    const today = new Date().toISOString().split('T')[0]

    let instances = await ctx.db
      .query('choreInstances')
      .withIndex('by_due_date', (q) => q.eq('dueDate', today))
      .collect()

    // Get participants and filter by child if specified
    const enriched = await Promise.all(
      instances.map(async (instance) => {
        const participants = await ctx.db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        // If filtering by child, check if they're a participant
        if (args.childId) {
          const isParticipant = participants.some(
            (p) => p.childId === args.childId
          )
          if (!isParticipant) return null
        }

        const schedule = await ctx.db.get(instance.scheduledChoreId)
        const template = schedule
          ? await ctx.db.get(schedule.choreTemplateId)
          : null

        // Get children data for participants
        const enrichedParticipants = await Promise.all(
          participants.map(async (p) => {
            const child = await ctx.db.get(p.childId)
            return { ...p, child }
          })
        )

        return {
          ...instance,
          template,
          schedule,
          participants: enrichedParticipants,
        }
      })
    )

    return enriched.filter(Boolean)
  },
})

// Get chores for a specific child
export const getForChild = query({
  args: {
    childId: v.id('children'),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get all participant records for this child
    const participations = await ctx.db
      .query('choreParticipants')
      .withIndex('by_child', (q) => q.eq('childId', args.childId))
      .collect()

    const instances = await Promise.all(
      participations.map(async (p) => {
        const instance = await ctx.db.get(p.choreInstanceId)
        if (!instance) return null

        // Filter by date range
        if (args.startDate && instance.dueDate < args.startDate) return null
        if (args.endDate && instance.dueDate > args.endDate) return null

        const schedule = await ctx.db.get(instance.scheduledChoreId)
        const template = schedule
          ? await ctx.db.get(schedule.choreTemplateId)
          : null

        // Get all participants for this instance
        const participants = await ctx.db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        const enrichedParticipants = await Promise.all(
          participants.map(async (part) => {
            const child = await ctx.db.get(part.childId)
            return { ...part, child }
          })
        )

        return {
          ...instance,
          template,
          schedule,
          participants: enrichedParticipants,
          myParticipation: p,
        }
      })
    )

    return instances.filter(Boolean)
  },
})

// Get chores awaiting review
export const getForReview = query({
  args: {},
  handler: async (ctx) => {
    // Get all pending instances where status is still pending but has completed work
    const instances = await ctx.db.query('choreInstances').collect()

    const forReview = await Promise.all(
      instances.map(async (instance) => {
        // Skip already completed or missed
        if (instance.status !== 'pending') return null
        if (instance.quality) return null // Already rated

        const participants = await ctx.db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        // Check if any work is done
        const doneCount = participants.filter((p) => p.status === 'done').length
        if (doneCount === 0) return null

        // For joined chores, all must be done (or parent can force review)
        // For individual chores, just need to be done
        const allDone = doneCount === participants.length

        const schedule = await ctx.db.get(instance.scheduledChoreId)
        const template = schedule
          ? await ctx.db.get(schedule.choreTemplateId)
          : null

        const enrichedParticipants = await Promise.all(
          participants.map(async (p) => {
            const child = await ctx.db.get(p.childId)
            return { ...p, child }
          })
        )

        return {
          ...instance,
          template,
          schedule,
          participants: enrichedParticipants,
          doneCount,
          totalCount: participants.length,
          allDone,
        }
      })
    )

    return forReview.filter(Boolean)
  },
})

// Get chore history with pagination
export const getHistory = query({
  args: {
    childId: v.optional(v.id('children')),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    let instances = await ctx.db
      .query('choreInstances')
      .withIndex('by_status', (q) => q.eq('status', 'completed'))
      .order('desc')
      .take(limit * 2) // Take extra to account for filtering

    // If filtering by child, we need to check participants
    if (args.childId) {
      const filtered = await Promise.all(
        instances.map(async (instance) => {
          const participants = await ctx.db
            .query('choreParticipants')
            .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
            .collect()

          const isParticipant = participants.some(
            (p) => p.childId === args.childId
          )
          return isParticipant ? instance : null
        })
      )
      instances = filtered.filter(Boolean) as typeof instances
    }

    instances = instances.slice(0, limit)

    // Enrich with data
    const enriched = await Promise.all(
      instances.map(async (instance) => {
        const schedule = await ctx.db.get(instance.scheduledChoreId)
        const template = schedule
          ? await ctx.db.get(schedule.choreTemplateId)
          : null

        const participants = await ctx.db
          .query('choreParticipants')
          .withIndex('by_instance', (q) => q.eq('choreInstanceId', instance._id))
          .collect()

        const enrichedParticipants = await Promise.all(
          participants.map(async (p) => {
            const child = await ctx.db.get(p.childId)
            return { ...p, child }
          })
        )

        return {
          ...instance,
          template,
          schedule,
          participants: enrichedParticipants,
        }
      })
    )

    return enriched
  },
})

// Mark individual child's part as done
export const markDone = mutation({
  args: {
    instanceId: v.id('choreInstances'),
    childId: v.id('children'),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId)
    if (!instance) {
      throw new Error('Chore instance not found')
    }

    if (instance.status !== 'pending') {
      throw new Error('Chore is not pending')
    }

    // Find participant record
    const participant = await ctx.db
      .query('choreParticipants')
      .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
      .filter((q) => q.eq(q.field('childId'), args.childId))
      .first()

    if (!participant) {
      throw new Error('Not a participant of this chore')
    }

    if (participant.status === 'done') {
      throw new Error('Already marked as done')
    }

    await ctx.db.patch(participant._id, {
      status: 'done',
      completedAt: Date.now(),
    })

    return { success: true }
  },
})

// Rate a chore (for individual chores)
export const rate = mutation({
  args: {
    instanceId: v.id('choreInstances'),
    quality: v.union(v.literal('bad'), v.literal('good'), v.literal('excellent')),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId)
    if (!instance) {
      throw new Error('Chore instance not found')
    }

    if (instance.status !== 'pending') {
      throw new Error('Chore is not pending')
    }

    const participants = await ctx.db
      .query('choreParticipants')
      .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
      .collect()

    if (participants.length === 0) {
      throw new Error('No participants found')
    }

    // For individual chores (1 participant)
    if (!instance.isJoined) {
      const participant = participants[0]
      const coefficient = QUALITY_COEFFICIENTS[args.quality]
      const earnedReward = Math.round(instance.totalReward * coefficient)

      // Update participant
      await ctx.db.patch(participant._id, {
        effortPercent: 100,
        earnedReward,
      })

      // Update child balance
      const child = await ctx.db.get(participant.childId)
      if (child) {
        await ctx.db.patch(participant.childId, {
          balance: child.balance + earnedReward,
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

        await ctx.db.patch(participant._id, {
          effortPercent: equalPercent,
          earnedReward,
        })

        // Update child balance
        const child = await ctx.db.get(participant.childId)
        if (child) {
          await ctx.db.patch(participant.childId, {
            balance: child.balance + earnedReward,
          })
        }
      }
    }

    // Update instance
    await ctx.db.patch(args.instanceId, {
      status: 'completed',
      quality: args.quality,
      completedAt: Date.now(),
      notes: args.notes,
    })

    return { success: true }
  },
})

// Rate joined chore with custom effort split
export const rateJoined = mutation({
  args: {
    instanceId: v.id('choreInstances'),
    quality: v.union(v.literal('bad'), v.literal('good'), v.literal('excellent')),
    efforts: v.array(
      v.object({
        childId: v.id('children'),
        effortPercent: v.number(),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId)
    if (!instance) {
      throw new Error('Chore instance not found')
    }

    if (!instance.isJoined) {
      throw new Error('Use rate() for individual chores')
    }

    if (instance.status !== 'pending') {
      throw new Error('Chore is not pending')
    }

    // Validate effort totals 100%
    const totalEffort = args.efforts.reduce((sum, e) => sum + e.effortPercent, 0)
    if (Math.abs(totalEffort - 100) > 0.01) {
      throw new Error('Effort percentages must total 100%')
    }

    const coefficient = QUALITY_COEFFICIENTS[args.quality]

    for (const effort of args.efforts) {
      const participant = await ctx.db
        .query('choreParticipants')
        .withIndex('by_instance', (q) => q.eq('choreInstanceId', args.instanceId))
        .filter((q) => q.eq(q.field('childId'), effort.childId))
        .first()

      if (!participant) {
        throw new Error(`Participant ${effort.childId} not found`)
      }

      const earnedReward = Math.round(
        instance.totalReward * (effort.effortPercent / 100) * coefficient
      )

      await ctx.db.patch(participant._id, {
        effortPercent: effort.effortPercent,
        earnedReward,
      })

      // Update child balance
      const child = await ctx.db.get(effort.childId)
      if (child) {
        await ctx.db.patch(effort.childId, {
          balance: child.balance + earnedReward,
        })
      }
    }

    // Update instance
    await ctx.db.patch(args.instanceId, {
      status: 'completed',
      quality: args.quality,
      completedAt: Date.now(),
      notes: args.notes,
    })

    return { success: true }
  },
})

// Mark chore as missed
export const markMissed = mutation({
  args: {
    instanceId: v.id('choreInstances'),
  },
  handler: async (ctx, args) => {
    const instance = await ctx.db.get(args.instanceId)
    if (!instance) {
      throw new Error('Chore instance not found')
    }

    if (instance.status !== 'pending') {
      throw new Error('Chore is not pending')
    }

    await ctx.db.patch(args.instanceId, {
      status: 'missed',
    })

    return { success: true }
  },
})

// Create a chore instance (used by scheduler or manually)
export const create = mutation({
  args: {
    scheduledChoreId: v.id('scheduledChores'),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const schedule = await ctx.db.get(args.scheduledChoreId)
    if (!schedule) {
      throw new Error('Scheduled chore not found')
    }

    // Create instance
    const instanceId = await ctx.db.insert('choreInstances', {
      scheduledChoreId: args.scheduledChoreId,
      dueDate: args.dueDate,
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

    return { id: instanceId }
  },
})
