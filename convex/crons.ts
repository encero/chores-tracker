import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Generate daily chores at midnight
crons.daily(
  'generate daily chores',
  { hourUTC: 5, minuteUTC: 0 }, // 5 AM UTC (adjust for your timezone)
  internal.scheduler.generateDailyChores
)

// Note: We no longer automatically mark chores as missed.
// Incomplete chores persist until completed or manually dismissed by parents.

// Clean up expired sessions weekly
crons.weekly(
  'cleanup sessions',
  { dayOfWeek: 'sunday', hourUTC: 3, minuteUTC: 0 },
  internal.auth.cleanupExpiredSessions
)

export default crons
