import { v } from 'convex/values'
import { query, mutation } from './_generated/server'

// List all chore templates
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('choreTemplates').collect()
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

// Create a new chore template
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    defaultReward: v.number(),
    icon: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert('choreTemplates', {
      name: args.name,
      description: args.description,
      defaultReward: args.defaultReward,
      icon: args.icon,
    })

    return { id }
  },
})

// Update a chore template
export const update = mutation({
  args: {
    id: v.id('choreTemplates'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    defaultReward: v.optional(v.number()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id)
    if (!template) {
      throw new Error('Template not found')
    }

    await ctx.db.patch(args.id, {
      ...(args.name !== undefined && { name: args.name }),
      ...(args.description !== undefined && { description: args.description }),
      ...(args.defaultReward !== undefined && {
        defaultReward: args.defaultReward,
      }),
      ...(args.icon !== undefined && { icon: args.icon }),
    })

    return { success: true }
  },
})

// Delete a chore template
export const remove = mutation({
  args: {
    id: v.id('choreTemplates'),
  },
  handler: async (ctx, args) => {
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
