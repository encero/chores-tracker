import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { requireAuth } from './lib/auth'

// List all chore templates
export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    const templates = await ctx.db.query('choreTemplates').collect()

    return {
      items: templates.slice(0, limit),
      hasMore: templates.length > limit,
      totalCount: templates.length,
    }
  },
})

// Get single template by ID
export const get = query({
  args: {
    id: v.id('choreTemplates'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Create a new chore template - requires auth
export const create = mutation({
  args: {
    token: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    defaultReward: v.number(),
    icon: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx.db, args.token)

    if (!args.name.trim()) {
      throw new Error('Name cannot be empty')
    }

    if (args.defaultReward < 0) {
      throw new Error('Default reward cannot be negative')
    }

    const id = await ctx.db.insert('choreTemplates', {
      name: args.name.trim(),
      description: args.description?.trim(),
      defaultReward: args.defaultReward,
      icon: args.icon,
    })

    return { id }
  },
})

// Update a chore template - requires auth
export const update = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id('choreTemplates'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    defaultReward: v.optional(v.number()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx.db, args.token)

    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }

    if (args.name !== undefined && !args.name.trim()) {
      throw new Error('Name cannot be empty')
    }

    if (args.defaultReward !== undefined && args.defaultReward < 0) {
      throw new Error('Default reward cannot be negative')
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name.trim() }),
      ...(args.description !== undefined && { description: args.description.trim() }),
      ...(args.defaultReward !== undefined && {
        defaultReward: args.defaultReward,
      }),
      ...(args.icon !== undefined && { icon: args.icon }),
    })

    return { success: true }
  },
})

// Delete a chore template - requires auth
export const remove = mutation({
  args: {
    token: v.optional(v.string()),
    id: v.id('choreTemplates'),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx.db, args.token)

    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }

    // Check if any scheduled chores use this template
    const schedules = await ctx.db
      .query('scheduledChores')
      .withIndex('by_template', (q) => q.eq('choreTemplateId', args.id))
      .collect()

    if (schedules.length > 0) {
      throw new Error(
        'Cannot delete template that is used in scheduled chores'
      )
    }

    await ctx.db.delete(args.id)

    return { success: true }
  },
})
