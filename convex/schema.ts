import { Schema } from 'effect'
import { Id, defineSchema, defineTable } from '@rjdellecese/confect/server'

// Quality rating schema - reused across multiple tables
const QualityRating = Schema.Union(
  Schema.Literal('failed'),
  Schema.Literal('bad'),
  Schema.Literal('good'),
  Schema.Literal('excellent')
)

// Schedule type schema
const ScheduleType = Schema.Union(
  Schema.Literal('once'),
  Schema.Literal('daily'),
  Schema.Literal('weekly'),
  Schema.Literal('custom')
)

// Chore instance status schema
const ChoreInstanceStatus = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('completed'),
  Schema.Literal('missed')
)

// Participant status schema
const ParticipantStatus = Schema.Union(
  Schema.Literal('pending'),
  Schema.Literal('done')
)

export const confectSchema = defineSchema({
  // App settings (single-row table)
  settings: defineTable(
    Schema.Struct({
      pinHash: Schema.optional(Schema.String), // Hashed parent PIN (null if not set)
      sessionDurationDays: Schema.Number, // How long sessions last (default: 7)
      currency: Schema.String, // Currency symbol (default: "$")
      ttsLanguage: Schema.optional(Schema.String), // TTS language code (e.g., "cs-CZ", "en-US")
    })
  ),

  // Session tokens for authentication
  sessions: defineTable(
    Schema.Struct({
      token: Schema.String, // Session token
      expiresAt: Schema.Number, // Timestamp when session expires
    })
  ).index('by_token', ['token']),

  // Children in the household
  children: defineTable(
    Schema.Struct({
      name: Schema.String, // Child's display name
      avatarEmoji: Schema.String, // Emoji avatar for kid-friendly UI
      accessCode: Schema.String, // Simple 4-digit code for kid's read-only view
      balance: Schema.Number, // Current accumulated reward balance (cents)
    })
  ).index('by_access_code', ['accessCode']),

  // Chore templates (reusable chore definitions)
  choreTemplates: defineTable(
    Schema.Struct({
      name: Schema.String, // Chore name (e.g., "Make bed")
      description: Schema.optional(Schema.String), // Optional detailed instructions
      defaultReward: Schema.Number, // Default reward in cents (0 = no reward)
      icon: Schema.String, // Emoji icon for visual recognition
    })
  ),

  // Scheduled chores (recurring or one-time assignments)
  scheduledChores: defineTable(
    Schema.Struct({
      childIds: Schema.Array(Id.Id('children')), // References to children (single or multiple for joined, empty for optional)
      choreTemplateId: Id.Id('choreTemplates'), // Reference to chore template
      reward: Schema.Number, // Total reward for this chore (cents, can override template)
      isJoined: Schema.Boolean, // True if this is a joined chore (reward split by effort)
      isOptional: Schema.Boolean, // True if kids can pick up this chore themselves
      maxPickupsPerPeriod: Schema.optional(Schema.Number), // Max times each child can pick up per period (null = unlimited)
      scheduleType: ScheduleType,
      scheduleDays: Schema.optional(Schema.Array(Schema.Number)), // For custom: days of week (0=Sun, 1=Mon...)
      startDate: Schema.String, // ISO date when schedule starts
      endDate: Schema.optional(Schema.String), // ISO date when schedule ends (null = indefinite)
      isActive: Schema.Boolean, // Whether schedule is active
    })
  )
    .index('by_child', ['childIds'])
    .index('by_template', ['choreTemplateId'])
    .index('by_active', ['isActive'])
    .index('by_optional', ['isOptional', 'isActive']),

  // Chore instances (actual chores to be completed on a specific day)
  choreInstances: defineTable(
    Schema.Struct({
      scheduledChoreId: Id.Id('scheduledChores'), // Reference to scheduled chore
      dueDate: Schema.String, // ISO date when chore is due
      isJoined: Schema.Boolean, // Copied from schedule for query convenience
      status: ChoreInstanceStatus,
      completedAt: Schema.optional(Schema.Number), // Timestamp when fully complete
      quality: Schema.optional(QualityRating), // Overall quality rating
      totalReward: Schema.Number, // Total reward pool for this instance
      notes: Schema.optional(Schema.String), // Optional parent notes
    })
  )
    .index('by_scheduled_chore', ['scheduledChoreId'])
    .index('by_due_date', ['dueDate'])
    .index('by_status', ['status'])
    .index('by_date_status', ['dueDate', 'status']),

  // Chore participants (tracks individual child participation in chore instances)
  choreParticipants: defineTable(
    Schema.Struct({
      choreInstanceId: Id.Id('choreInstances'), // Reference to chore instance
      childId: Id.Id('children'), // Reference to child
      status: ParticipantStatus, // Individual completion status
      completedAt: Schema.optional(Schema.Number), // When this child marked done
      effortPercent: Schema.optional(Schema.Number), // Effort contribution 0-100 (for joined chores)
      earnedReward: Schema.optional(Schema.Number), // Actual reward earned (calculated after review)
      quality: Schema.optional(QualityRating), // Individual quality rating (for joined chores)
    })
  )
    .index('by_instance', ['choreInstanceId'])
    .index('by_child', ['childId'])
    .index('by_child_status', ['childId', 'status']),

  // Balance history (withdrawals and adjustments)
  withdrawals: defineTable(
    Schema.Struct({
      childId: Id.Id('children'), // Reference to child
      amount: Schema.Number, // Signed amount in cents (negative = removal, positive = addition)
      createdAt: Schema.Number, // Timestamp of withdrawal
      note: Schema.optional(Schema.String), // Optional note (e.g., "Bought toy")
    })
  ).index('by_child', ['childId']),
})

// Export types for use in other files
export type QualityRating = Schema.Schema.Type<typeof QualityRating>
export type ScheduleType = Schema.Schema.Type<typeof ScheduleType>
export type ChoreInstanceStatus = Schema.Schema.Type<typeof ChoreInstanceStatus>
export type ParticipantStatus = Schema.Schema.Type<typeof ParticipantStatus>

// Export the Convex schema definition as default
export default confectSchema.convexSchemaDefinition
