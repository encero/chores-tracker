import { makeFunctions } from '@rjdellecese/confect/server'
import { confectSchema } from './schema'
import type { ConfectDataModelFromConfectSchemaDefinition } from '@rjdellecese/confect/server'

// Create Effect-based Convex functions
export const { query, internalQuery, mutation, internalMutation, action, internalAction } =
  makeFunctions(confectSchema)

// Export data model type for use in context types
export type ConfectDataModel = ConfectDataModelFromConfectSchemaDefinition<typeof confectSchema>
