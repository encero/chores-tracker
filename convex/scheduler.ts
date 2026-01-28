import { internalMutation } from './_generated/server'

// Get today's date in ISO format
function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

// Get day of week (0 = Sunday, 1 = Monday, etc.)
function getDayOfWeek(): number {
  return new Date().getDay()
}

// Generate daily chores based on schedules
export const generateDailyChores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = getToday()
    const dayOfWeek = getDayOfWeek()

    // Get all active schedules
    const schedules = await ctx.db
      .query('scheduledChores')
      .withIndex('by_active', (q) => q.eq('isActive', true))
      .collect()

    let created = 0

    for (const schedule of schedules) {
      // Check if we should create an instance today
      let shouldCreate = false

      // Check date range
      if (schedule.startDate > today) continue
      if (schedule.endDate && schedule.endDate < today) continue

      // skip optional schedules
      if (schedule.isOptional) continue

      switch (schedule.scheduleType) {
        case 'daily':
          shouldCreate = true
          break
        case 'weekly': {
          // Weekly chores happen on the start date's day of week
          const startDay = new Date(schedule.startDate).getDay()
          shouldCreate = dayOfWeek === startDay
          break
        }
        case 'custom':
          // Check if today is one of the scheduled days
          shouldCreate = schedule.scheduleDays?.includes(dayOfWeek) ?? false
          break
        case 'once':
          // One-time chores only on start date
          shouldCreate = schedule.startDate === today
          break
      }

      if (!shouldCreate) continue

      // Check if instance already exists for today
      const existing = await ctx.db
        .query('choreInstances')
        .withIndex('by_scheduled_chore', (q) =>
          q.eq('scheduledChoreId', schedule._id)
        )
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

      // If this was a one-time chore, deactivate the schedule
      if (schedule.scheduleType === 'once') {
        await ctx.db.patch(schedule._id, { isActive: false })
      }
    }

    return { created }
  },
})
