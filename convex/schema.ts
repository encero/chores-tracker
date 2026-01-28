import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // App settings (single-row table)
  settings: defineTable({
    pinHash: v.optional(v.string()), // Hashed parent PIN (null if not set)
    sessionDurationDays: v.number(), // How long sessions last (default: 7)
    currency: v.string(), // Currency symbol (default: "$")
    ttsLanguage: v.optional(v.string()), // TTS language code (e.g., "cs-CZ", "en-US")
  }),

  // Session tokens for authentication
  sessions: defineTable({
    token: v.string(), // Session token
    expiresAt: v.number(), // Timestamp when session expires
  }).index('by_token', ['token']),

  // Children in the household
  children: defineTable({
    name: v.string(), // Child's display name
    avatarEmoji: v.string(), // Emoji avatar for kid-friendly UI
    accessCode: v.string(), // Simple 4-digit code for kid's read-only view
    balance: v.number(), // Current accumulated reward balance (cents)
  }).index('by_access_code', ['accessCode']),

  // Chore templates (reusable chore definitions)
  choreTemplates: defineTable({
    name: v.string(), // Chore name (e.g., "Make bed")
    description: v.optional(v.string()), // Optional detailed instructions
    defaultReward: v.number(), // Default reward in cents (0 = no reward)
    icon: v.string(), // Emoji icon for visual recognition
  }),

  // Scheduled chores (recurring or one-time assignments)
  scheduledChores: defineTable({
    childIds: v.array(v.id('children')), // References to children (single or multiple for joined, empty for optional)
    choreTemplateId: v.id('choreTemplates'), // Reference to chore template
    reward: v.number(), // Total reward for this chore (cents, can override template)
    isJoined: v.boolean(), // True if this is a joined chore (reward split by effort)
    isOptional: v.boolean(), // True if kids can pick up this chore themselves
    maxPickupsPerPeriod: v.optional(v.number()), // Max times each child can pick up per period (null = unlimited)
    scheduleType: v.union(
      v.literal('once'),
      v.literal('daily'),
      v.literal('weekly'),
      v.literal('custom')
    ),
    scheduleDays: v.optional(v.array(v.number())), // For custom: days of week (0=Sun, 1=Mon...)
    startDate: v.string(), // ISO date when schedule starts
    endDate: v.optional(v.string()), // ISO date when schedule ends (null = indefinite)
    isActive: v.boolean(), // Whether schedule is active
  })
    .index('by_child', ['childIds'])
    .index('by_template', ['choreTemplateId'])
    .index('by_active', ['isActive'])
    .index('by_optional', ['isOptional', 'isActive']),

  // Chore instances (actual chores to be completed on a specific day)
  choreInstances: defineTable({
    scheduledChoreId: v.id('scheduledChores'), // Reference to scheduled chore
    dueDate: v.string(), // ISO date when chore is due
    isJoined: v.boolean(), // Copied from schedule for query convenience
    status: v.union(
      v.literal('pending'),
      v.literal('completed'),
      v.literal('missed')
    ),
    completedAt: v.optional(v.number()), // Timestamp when fully complete
    quality: v.optional(
      v.union(v.literal('failed'), v.literal('bad'), v.literal('good'), v.literal('excellent'))
    ), // Overall quality rating
    totalReward: v.number(), // Total reward pool for this instance
    notes: v.optional(v.string()), // Optional parent notes
  })
    .index('by_scheduled_chore', ['scheduledChoreId'])
    .index('by_due_date', ['dueDate'])
    .index('by_status', ['status'])
    .index('by_date_status', ['dueDate', 'status']),

  // Chore participants (tracks individual child participation in chore instances)
  choreParticipants: defineTable({
    choreInstanceId: v.id('choreInstances'), // Reference to chore instance
    childId: v.id('children'), // Reference to child
    status: v.union(v.literal('pending'), v.literal('done')), // Individual completion status
    completedAt: v.optional(v.number()), // When this child marked done
    effortPercent: v.optional(v.number()), // Effort contribution 0-100 (for joined chores)
    earnedReward: v.optional(v.number()), // Actual reward earned (calculated after review)
    quality: v.optional(
      v.union(v.literal('failed'), v.literal('bad'), v.literal('good'), v.literal('excellent'))
    ), // Individual quality rating (for joined chores)
  })
    .index('by_instance', ['choreInstanceId'])
    .index('by_child', ['childId'])
    .index('by_child_status', ['childId', 'status']),

  // Balance history (withdrawals and adjustments)
  withdrawals: defineTable({
    childId: v.id('children'), // Reference to child
    amount: v.number(), // Signed amount in cents (negative = removal, positive = addition)
    createdAt: v.number(), // Timestamp of withdrawal
    note: v.optional(v.string()), // Optional note (e.g., "Bought toy")
  }).index('by_child', ['childId']),
})
