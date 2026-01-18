import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Generate daily chores at midnight
crons.daily(
  'generate daily chores',
  { hourUTC: 5, minuteUTC: 0 }, // 5 AM UTC (adjust for your timezone)
  internal.scheduler.generateDailyChores
)

// Mark missed chores at midnight
crons.daily(
  'mark missed chores',
  { hourUTC: 5, minuteUTC: 5 }, // 5:05 AM UTC
  internal.scheduler.markMissedChores
)

// Clean up expired sessions weekly
crons.weekly(
  'cleanup sessions',
  { dayOfWeek: 'sunday', hourUTC: 3, minuteUTC: 0 },
  internal.auth.cleanupExpiredSessions
)

export default crons
