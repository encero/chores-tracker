# Effect Library Migration Plan

## Executive Summary

This document outlines a phased migration strategy for adopting the [Effect](https://effect.website/) library in the Chores Tracker application. Effect is a TypeScript library providing type-safe error handling, dependency injection, composable computations, and schema validation.

**Current Stack:**
- Frontend: React 19 + TanStack Start/Router
- Backend: Convex (serverless functions + real-time database)
- Runtime: Bun
- Testing: Vitest + Playwright

**Migration Approach:** Incremental adoption starting with low-risk utility layers, expanding to business logic, with careful consideration for Convex integration constraints.

---

## Table of Contents

1. [Why Effect?](#1-why-effect)
2. [Migration Challenges](#2-migration-challenges)
3. [Phase Overview](#3-phase-overview)
4. [Phase 1: Foundation & Schema](#4-phase-1-foundation--schema)
5. [Phase 2: Utility Functions](#5-phase-2-utility-functions)
6. [Phase 3: Backend Business Logic](#6-phase-3-backend-business-logic)
7. [Phase 4: Frontend Integration](#7-phase-4-frontend-integration)
8. [Phase 5: Advanced Patterns](#8-phase-5-advanced-patterns)
9. [Testing Strategy](#9-testing-strategy)
10. [Rollback Plan](#10-rollback-plan)
11. [Success Metrics](#11-success-metrics)
12. [Timeline Estimates](#12-timeline-estimates)

---

## 1. Why Effect?

### Current Pain Points

| Issue | Current State | Effect Solution |
|-------|--------------|-----------------|
| **Error Handling** | Generic `throw new Error()` - untyped | `Effect<A, E, R>` - typed errors in signatures |
| **Error Recovery** | Try/catch scattered, inconsistent | Composable error handlers (`catchTag`, `catchAll`) |
| **Validation** | Manual checks, not reusable | `@effect/schema` - runtime + compile-time validation |
| **Business Logic Composition** | Nested async/await, callback patterns | Pipe-based composition with Effect combinators |
| **Testing** | Must mock entire modules | Service-based DI - inject test implementations |
| **Type Safety** | Missing error types | Full type inference including failures |

### Benefits for Chores Tracker

1. **Typed Errors**: Know exactly which errors a function can produce
   ```typescript
   // Before
   async function rateChore(id: string): Promise<void> {
     throw new Error('Chore not found') // Unknown to callers
   }

   // After
   function rateChore(id: string): Effect<void, ChoreNotFoundError | InvalidStateError, ChoreService> {
     // Errors are part of the type signature
   }
   ```

2. **Schema Validation**: Shared validation between frontend/backend
   ```typescript
   const PinSchema = Schema.String.pipe(
     Schema.pattern(/^\d{4,6}$/),
     Schema.brand("Pin")
   )
   // Use same schema in forms and API validation
   ```

3. **Better Testing**: Inject mock services without module mocking
4. **Reduced Boilerplate**: Compose complex async operations cleanly

---

## 2. Migration Challenges

### 2.1 Convex Compatibility

**Challenge:** Convex functions have their own execution context and patterns.

**Constraints:**
- Convex mutations/queries must return plain values or Promises
- Effect's runtime (`Effect.runPromise`) must be called at the boundary
- Convex `ctx` object cannot be directly used in Effect services

**Solution Strategy:**
- Create adapter layer between Effect and Convex
- Use Effect for internal business logic
- Run Effect at Convex function boundaries

```typescript
// Convex adapter pattern
export const markDone = mutation({
  args: { ... },
  handler: async (ctx, args) => {
    // Create Effect-compatible context
    const services = makeConvexServices(ctx)

    // Run Effect program
    return Effect.runPromise(
      markDoneEffect(args).pipe(
        Effect.provide(services)
      )
    )
  }
})
```

### 2.2 Learning Curve

**Challenge:** Effect has significant learning curve for team members.

**Mitigation:**
- Start with `@effect/schema` (most approachable)
- Document patterns specific to this codebase
- Limit initial scope to utility functions

### 2.3 Bundle Size

**Challenge:** Effect adds ~50-80KB to bundle (minified).

**Mitigation:**
- Tree-shaking removes unused modules
- Use `@effect/schema` standalone if full Effect not needed
- Monitor bundle size throughout migration

### 2.4 Debugging

**Challenge:** Stack traces through Effect can be harder to read.

**Mitigation:**
- Use `Effect.annotateCurrentSpan` for tracing
- Enable Effect's debug mode in development
- Add meaningful error tags

---

## 3. Phase Overview

```
Phase 1: Foundation & Schema (Low Risk)
├── Install dependencies
├── Add @effect/schema for validation
└── Create shared domain schemas

Phase 2: Utility Functions (Low Risk)
├── Migrate currency.ts to Effect
├── Migrate hash.ts to Effect
└── Add Effect-based utilities

Phase 3: Backend Business Logic (Medium Risk)
├── Create Convex-Effect adapter layer
├── Migrate choreInstances.ts logic
├── Migrate auth.ts logic
└── Add typed error hierarchy

Phase 4: Frontend Integration (Medium Risk)
├── Create Effect-based hooks
├── Integrate schemas with forms
└── Add error handling utilities

Phase 5: Advanced Patterns (Higher Risk)
├── Full service layer
├── Observability/tracing
└── Remaining migrations
```

---

## 4. Phase 1: Foundation & Schema

**Goal:** Install Effect, create shared schemas, validate approach with minimal risk.

### 4.1 Installation

```bash
bun add effect @effect/schema
```

### 4.2 Directory Structure

```
src/
├── effect/
│   ├── schemas/
│   │   ├── common.ts       # Shared primitives
│   │   ├── child.ts        # Child domain schemas
│   │   ├── chore.ts        # Chore domain schemas
│   │   └── index.ts        # Re-exports
│   └── errors/
│       └── index.ts        # Shared error types
convex/
├── effect/
│   ├── schemas/            # Backend-specific schemas
│   └── services/           # Convex service adapters
```

### 4.3 Schema Definitions

**File: `src/effect/schemas/common.ts`**
```typescript
import { Schema } from "@effect/schema"

// Branded types for type-safe IDs
export const ChildId = Schema.String.pipe(Schema.brand("ChildId"))
export type ChildId = Schema.Schema.Type<typeof ChildId>

export const ChoreTemplateId = Schema.String.pipe(Schema.brand("ChoreTemplateId"))
export const ChoreInstanceId = Schema.String.pipe(Schema.brand("ChoreInstanceId"))

// Domain value objects
export const Pin = Schema.String.pipe(
  Schema.pattern(/^\d{4,6}$/),
  Schema.brand("Pin")
)

export const AccessCode = Schema.String.pipe(
  Schema.pattern(/^\d{4}$/),
  Schema.brand("AccessCode")
)

export const CentsAmount = Schema.Number.pipe(
  Schema.int(),
  Schema.nonNegative(),
  Schema.brand("Cents")
)

export const EffortPercent = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(100),
  Schema.brand("EffortPercent")
)
```

**File: `src/effect/schemas/chore.ts`**
```typescript
import { Schema } from "@effect/schema"
import { CentsAmount, ChildId, ChoreInstanceId } from "./common"

export const ChoreStatus = Schema.Literal("pending", "completed", "missed")
export type ChoreStatus = Schema.Schema.Type<typeof ChoreStatus>

export const ChoreQuality = Schema.Literal("failed", "bad", "good", "excellent")
export type ChoreQuality = Schema.Schema.Type<typeof ChoreQuality>

export const ParticipantStatus = Schema.Literal("pending", "done")
export type ParticipantStatus = Schema.Schema.Type<typeof ParticipantStatus>

export const ScheduleType = Schema.Literal("once", "daily", "weekly", "custom")
export type ScheduleType = Schema.Schema.Type<typeof ScheduleType>

// Quality coefficients as schema with built-in documentation
export const QualityCoefficient = Schema.Struct({
  failed: Schema.Literal(0),
  bad: Schema.Literal(0.5),
  good: Schema.Literal(1.0),
  excellent: Schema.Literal(1.25),
})

export const RateChoreInput = Schema.Struct({
  instanceId: ChoreInstanceId,
  quality: ChoreQuality,
  notes: Schema.optional(Schema.String),
  participants: Schema.Array(
    Schema.Struct({
      childId: ChildId,
      effortPercent: Schema.Number.pipe(
        Schema.greaterThanOrEqualTo(0),
        Schema.lessThanOrEqualTo(100)
      ),
    })
  ),
})
```

### 4.4 Error Types

**File: `src/effect/errors/index.ts`**
```typescript
import { Data } from "effect"

// Base tagged error class
export class ChoreNotFoundError extends Data.TaggedError("ChoreNotFoundError")<{
  readonly choreId: string
}> {}

export class ChildNotFoundError extends Data.TaggedError("ChildNotFoundError")<{
  readonly childId: string
}> {}

export class InvalidStateError extends Data.TaggedError("InvalidStateError")<{
  readonly expected: string
  readonly actual: string
  readonly entity: string
}> {}

export class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string
  readonly message: string
}> {}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly reason: "invalid_pin" | "session_expired" | "no_session"
}> {}

export class EffortDistributionError extends Data.TaggedError("EffortDistributionError")<{
  readonly total: number
  readonly expected: 100
}> {}
```

### 4.5 Phase 1 Deliverables

- [ ] Install `effect` and `@effect/schema`
- [ ] Create `src/effect/schemas/` with common schemas
- [ ] Create `src/effect/errors/` with typed errors
- [ ] Add schema exports to shared barrel files
- [ ] Update TypeScript config if needed
- [ ] Verify build passes
- [ ] Document schema usage patterns

---

## 5. Phase 2: Utility Functions

**Goal:** Migrate pure utility functions to Effect, establishing patterns for the team.

### 5.1 Currency Utilities Migration

**Current: `src/lib/currency.ts`**
```typescript
export function calculateReward(
  totalReward: number,
  quality: ChoreQuality
): number {
  const coefficient = QUALITY_COEFFICIENTS[quality]
  return Math.round(totalReward * coefficient)
}
```

**Migrated: `src/lib/currency.effect.ts`**
```typescript
import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { CentsAmount, ChoreQuality, EffortPercent } from "@/effect/schemas"
import { ValidationError } from "@/effect/errors"

const QUALITY_COEFFICIENTS = {
  failed: 0,
  bad: 0.5,
  good: 1.0,
  excellent: 1.25,
} as const

// Pure function wrapped in Effect for composition
export const calculateReward = (
  totalReward: number,
  quality: ChoreQuality,
  effortPercent: number = 100
): Effect.Effect<number, ValidationError> =>
  pipe(
    Effect.all([
      Schema.decode(CentsAmount)(totalReward),
      Schema.decode(EffortPercent)(effortPercent),
    ]),
    Effect.mapError(() =>
      new ValidationError({ field: "reward", message: "Invalid amount" })
    ),
    Effect.map(([amount, effort]) => {
      const coefficient = QUALITY_COEFFICIENTS[quality]
      return Math.round(amount * (effort / 100) * coefficient)
    })
  )

// Sync version for simple cases
export const calculateRewardSync = (
  totalReward: number,
  quality: ChoreQuality,
  effortPercent: number = 100
): number => {
  const coefficient = QUALITY_COEFFICIENTS[quality]
  return Math.round(totalReward * (effortPercent / 100) * coefficient)
}
```

### 5.2 Hash Utilities Migration

**Current: `convex/lib/hash.ts`**
```typescript
export function hashPin(pin: string, salt: string): string {
  return sha256(pin + salt)
}

export function generateSessionToken(): string {
  // Random token generation
}
```

**Migrated: `convex/lib/hash.effect.ts`**
```typescript
import { Effect } from "effect"
import { Schema } from "@effect/schema"
import { Pin, ValidationError } from "@/effect/schemas"

export const hashPin = (
  pin: string,
  salt: string
): Effect.Effect<string, ValidationError> =>
  pipe(
    Schema.decode(Pin)(pin),
    Effect.mapError((e) =>
      new ValidationError({ field: "pin", message: "Invalid PIN format" })
    ),
    Effect.map((validPin) => sha256(validPin + salt))
  )

// Generate cryptographically secure token
export const generateSessionToken = (): Effect.Effect<string, never> =>
  Effect.sync(() => {
    const bytes = new Uint8Array(32)
    crypto.getRandomValues(bytes)
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  })
```

### 5.3 Validation Utilities

**New: `src/lib/validation.effect.ts`**
```typescript
import { Effect, pipe } from "effect"
import { Schema } from "@effect/schema"
import { EffortDistributionError } from "@/effect/errors"

export const validateEffortDistribution = (
  participants: Array<{ effortPercent: number }>
): Effect.Effect<void, EffortDistributionError> => {
  const total = participants.reduce((sum, p) => sum + p.effortPercent, 0)

  return Math.abs(total - 100) < 0.01
    ? Effect.void
    : Effect.fail(new EffortDistributionError({ total, expected: 100 }))
}

export const validateNonEmpty = <A>(
  items: readonly A[],
  name: string
): Effect.Effect<readonly A[], ValidationError> =>
  items.length > 0
    ? Effect.succeed(items)
    : Effect.fail(new ValidationError({ field: name, message: `${name} cannot be empty` }))
```

### 5.4 Phase 2 Deliverables

- [ ] Migrate `currency.ts` calculations to Effect
- [ ] Migrate `hash.ts` to Effect
- [ ] Create validation utilities
- [ ] Update tests for Effect versions
- [ ] Keep original functions as deprecated wrappers (gradual migration)
- [ ] Document Effect utility patterns

---

## 6. Phase 3: Backend Business Logic

**Goal:** Integrate Effect into Convex mutations/queries with typed errors.

### 6.1 Convex-Effect Adapter

**File: `convex/effect/adapter.ts`**
```typescript
import { Effect, Layer, Context } from "effect"
import type { MutationCtx, QueryCtx } from "./_generated/server"

// Service interfaces
export class DatabaseService extends Context.Tag("DatabaseService")<
  DatabaseService,
  {
    readonly get: <T extends TableNames>(
      id: Id<T>
    ) => Effect.Effect<Doc<T> | null, never>
    readonly insert: <T extends TableNames>(
      table: T,
      doc: Omit<Doc<T>, "_id" | "_creationTime">
    ) => Effect.Effect<Id<T>, never>
    readonly patch: <T extends TableNames>(
      id: Id<T>,
      patch: Partial<Doc<T>>
    ) => Effect.Effect<void, never>
    readonly delete: <T extends TableNames>(
      id: Id<T>
    ) => Effect.Effect<void, never>
    readonly query: <T extends TableNames>(
      table: T
    ) => QueryBuilder<T>
  }
>() {}

// Create service from Convex context
export const makeDatabaseService = (ctx: MutationCtx | QueryCtx) =>
  Layer.succeed(
    DatabaseService,
    DatabaseService.of({
      get: (id) => Effect.promise(() => ctx.db.get(id)),
      insert: (table, doc) => Effect.promise(() => ctx.db.insert(table, doc)),
      patch: (id, patch) => Effect.promise(() => ctx.db.patch(id, patch)),
      delete: (id) => Effect.promise(() => ctx.db.delete(id)),
      query: (table) => ctx.db.query(table),
    })
  )

// Helper to run Effect in Convex handler
export const runEffect = <A, E>(
  ctx: MutationCtx | QueryCtx,
  effect: Effect.Effect<A, E, DatabaseService>
): Promise<A> =>
  Effect.runPromise(
    effect.pipe(Effect.provide(makeDatabaseService(ctx)))
  )
```

### 6.2 Chore Instance Logic Migration

**File: `convex/effect/choreLogic.ts`**
```typescript
import { Effect, pipe } from "effect"
import { DatabaseService } from "./adapter"
import {
  ChoreNotFoundError,
  ChildNotFoundError,
  InvalidStateError,
  EffortDistributionError,
} from "@/effect/errors"
import { ChoreQuality } from "@/effect/schemas"

export const markChoreAsDone = (
  instanceId: Id<"choreInstances">,
  childId: Id<"children">
): Effect.Effect<
  void,
  ChoreNotFoundError | ChildNotFoundError | InvalidStateError,
  DatabaseService
> =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    // Get and validate instance
    const instance = yield* db.get(instanceId)
    if (!instance) {
      return yield* Effect.fail(new ChoreNotFoundError({ choreId: instanceId }))
    }
    if (instance.status !== "pending") {
      return yield* Effect.fail(
        new InvalidStateError({
          entity: "ChoreInstance",
          expected: "pending",
          actual: instance.status,
        })
      )
    }

    // Get and validate participant
    const participant = yield* pipe(
      db.query("choreParticipants"),
      Effect.flatMap((q) =>
        Effect.promise(() =>
          q.withIndex("by_instance", (q) => q.eq("choreInstanceId", instanceId))
            .filter((q) => q.eq(q.field("childId"), childId))
            .first()
        )
      )
    )

    if (!participant) {
      return yield* Effect.fail(new ChildNotFoundError({ childId }))
    }

    // Update participant status
    yield* db.patch(participant._id, {
      status: "done",
      completedAt: Date.now(),
    })

    // Check if all participants are done
    const allParticipants = yield* pipe(
      db.query("choreParticipants"),
      Effect.flatMap((q) =>
        Effect.promise(() =>
          q.withIndex("by_instance", (q) => q.eq("choreInstanceId", instanceId))
            .collect()
        )
      )
    )

    const allDone = allParticipants.every((p) =>
      p._id === participant._id ? true : p.status === "done"
    )

    if (allDone && !instance.isJoined) {
      // Auto-complete non-joined chores
      yield* db.patch(instanceId, {
        status: "completed",
        completedAt: Date.now(),
      })
    }
  })

export const rateChore = (
  instanceId: Id<"choreInstances">,
  quality: ChoreQuality,
  participants: Array<{ childId: Id<"children">; effortPercent: number }>,
  notes?: string
): Effect.Effect<
  void,
  ChoreNotFoundError | InvalidStateError | EffortDistributionError,
  DatabaseService
> =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    // Validate effort distribution
    const totalEffort = participants.reduce((sum, p) => sum + p.effortPercent, 0)
    if (Math.abs(totalEffort - 100) > 0.01) {
      return yield* Effect.fail(
        new EffortDistributionError({ total: totalEffort, expected: 100 })
      )
    }

    // Get instance
    const instance = yield* db.get(instanceId)
    if (!instance) {
      return yield* Effect.fail(new ChoreNotFoundError({ choreId: instanceId }))
    }

    // Calculate and distribute rewards
    const coefficient = QUALITY_COEFFICIENTS[quality]

    for (const { childId, effortPercent } of participants) {
      const earnedReward = Math.round(
        instance.totalReward * (effortPercent / 100) * coefficient
      )

      // Update participant
      yield* pipe(
        db.query("choreParticipants"),
        Effect.flatMap((q) =>
          Effect.promise(() =>
            q.withIndex("by_instance", (q) => q.eq("choreInstanceId", instanceId))
              .filter((q) => q.eq(q.field("childId"), childId))
              .first()
          )
        ),
        Effect.flatMap((participant) =>
          participant
            ? db.patch(participant._id, {
                quality,
                effortPercent,
                earnedReward,
              })
            : Effect.void
        )
      )

      // Update child balance
      const child = yield* db.get(childId)
      if (child) {
        yield* db.patch(childId, {
          balance: child.balance + earnedReward,
        })
      }
    }

    // Update instance
    yield* db.patch(instanceId, {
      status: "completed",
      completedAt: Date.now(),
      quality,
      notes,
    })
  })
```

### 6.3 Updated Convex Mutation

**File: `convex/choreInstances.ts` (updated)**
```typescript
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { runEffect } from "./effect/adapter"
import { markChoreAsDone, rateChore } from "./effect/choreLogic"
import { ChoreNotFoundError, InvalidStateError } from "@/effect/errors"
import { Effect } from "effect"

export const markDone = mutation({
  args: {
    instanceId: v.id("choreInstances"),
    childId: v.id("children"),
  },
  handler: async (ctx, args) => {
    return runEffect(
      ctx,
      markChoreAsDone(args.instanceId, args.childId).pipe(
        // Convert typed errors to user-friendly messages
        Effect.catchTags({
          ChoreNotFoundError: (e) =>
            Effect.fail(new Error(`Chore not found: ${e.choreId}`)),
          ChildNotFoundError: (e) =>
            Effect.fail(new Error(`Child not found: ${e.childId}`)),
          InvalidStateError: (e) =>
            Effect.fail(new Error(`Chore is not ${e.expected}, it is ${e.actual}`)),
        })
      )
    )
  },
})

export const rate = mutation({
  args: {
    instanceId: v.id("choreInstances"),
    quality: v.union(
      v.literal("failed"),
      v.literal("bad"),
      v.literal("good"),
      v.literal("excellent")
    ),
    participants: v.array(
      v.object({
        childId: v.id("children"),
        effortPercent: v.number(),
      })
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return runEffect(
      ctx,
      rateChore(args.instanceId, args.quality, args.participants, args.notes).pipe(
        Effect.catchTags({
          ChoreNotFoundError: () =>
            Effect.fail(new Error("Chore not found")),
          InvalidStateError: (e) =>
            Effect.fail(new Error(`Cannot rate: chore is ${e.actual}`)),
          EffortDistributionError: (e) =>
            Effect.fail(new Error(`Effort must total 100%, got ${e.total}%`)),
        })
      )
    )
  },
})
```

### 6.4 Phase 3 Deliverables

- [ ] Create Convex-Effect adapter layer
- [ ] Migrate `choreInstances.ts` business logic
- [ ] Migrate `auth.ts` business logic
- [ ] Migrate `scheduledChores.ts` validation
- [ ] Add error mapping at mutation boundaries
- [ ] Update/add tests for Effect logic
- [ ] Document Convex-Effect patterns

---

## 7. Phase 4: Frontend Integration

**Goal:** Integrate Effect with React for forms, API calls, and error handling.

### 7.1 Effect React Hooks

**File: `src/hooks/useEffectMutation.ts`**
```typescript
import { useCallback, useState } from "react"
import { Effect } from "effect"
import { useMutation } from "convex/react"

type MutationState<E> = {
  isLoading: boolean
  error: E | null
}

export function useEffectMutation<Args, Result, E>(
  mutation: ReturnType<typeof useMutation>,
  errorHandler: (error: unknown) => E
) {
  const [state, setState] = useState<MutationState<E>>({
    isLoading: false,
    error: null,
  })

  const execute = useCallback(
    async (args: Args): Promise<Result | null> => {
      setState({ isLoading: true, error: null })
      try {
        const result = await mutation(args)
        setState({ isLoading: false, error: null })
        return result
      } catch (e) {
        const error = errorHandler(e)
        setState({ isLoading: false, error })
        return null
      }
    },
    [mutation, errorHandler]
  )

  return { ...state, execute }
}
```

### 7.2 Form Validation with Schema

**File: `src/components/forms/ChoreRatingForm.tsx`**
```typescript
import { Schema } from "@effect/schema"
import { Effect, Either } from "effect"
import { RateChoreInput } from "@/effect/schemas"

const validateForm = (data: unknown): Either.Either<FormErrors, RateChoreInput> =>
  Schema.decodeUnknownEither(RateChoreInput)(data).pipe(
    Either.mapLeft((error) => ({
      // Transform schema errors to form-friendly format
      fields: formatSchemaErrors(error),
    }))
  )

export function ChoreRatingForm({ instanceId }: Props) {
  const [formData, setFormData] = useState(initialData)
  const [errors, setErrors] = useState<FormErrors | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const validation = validateForm(formData)

    if (Either.isLeft(validation)) {
      setErrors(validation.left)
      return
    }

    // Proceed with validated data
    await submitRating(validation.right)
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields with error display */}
    </form>
  )
}
```

### 7.3 Error Boundary with Effect

**File: `src/components/ErrorBoundary.tsx`**
```typescript
import { Match } from "effect"
import {
  ChoreNotFoundError,
  AuthenticationError,
  ValidationError
} from "@/effect/errors"

export function ErrorDisplay({ error }: { error: unknown }) {
  // Pattern match on error types
  const message = Match.value(error).pipe(
    Match.when(Match.instanceOf(ChoreNotFoundError), (e) =>
      `Chore not found: ${e.choreId}`
    ),
    Match.when(Match.instanceOf(AuthenticationError), (e) =>
      Match.value(e.reason).pipe(
        Match.when("invalid_pin", () => "Invalid PIN"),
        Match.when("session_expired", () => "Session expired, please log in again"),
        Match.when("no_session", () => "Please log in"),
        Match.exhaustive
      )
    ),
    Match.when(Match.instanceOf(ValidationError), (e) =>
      `${e.field}: ${e.message}`
    ),
    Match.orElse(() => "An unexpected error occurred")
  )

  return <div className="error-message">{message}</div>
}
```

### 7.4 Phase 4 Deliverables

- [ ] Create Effect-based mutation hooks
- [ ] Integrate schemas with form validation
- [ ] Add error display components with pattern matching
- [ ] Update existing forms to use schemas
- [ ] Add TypeScript integration for better DX
- [ ] Document frontend Effect patterns

---

## 8. Phase 5: Advanced Patterns

**Goal:** Full service layer, observability, and remaining migrations.

### 8.1 Service Layer Architecture

```typescript
// Services for full DI support
export class ChoreService extends Context.Tag("ChoreService")<
  ChoreService,
  {
    readonly getToday: () => Effect.Effect<ChoreInstance[], DatabaseError>
    readonly markDone: (id: string, childId: string) => Effect.Effect<void, ChoreError>
    readonly rate: (input: RateInput) => Effect.Effect<void, RatingError>
  }
>() {}

export class ChildService extends Context.Tag("ChildService")<
  ChildService,
  {
    readonly getAll: () => Effect.Effect<Child[], DatabaseError>
    readonly getByAccessCode: (code: string) => Effect.Effect<Child | null, never>
    readonly updateBalance: (id: string, delta: number) => Effect.Effect<void, ChildError>
  }
>() {}

export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  {
    readonly login: (pin: string) => Effect.Effect<Session, AuthError>
    readonly verify: (token: string) => Effect.Effect<boolean, never>
    readonly logout: (token: string) => Effect.Effect<void, never>
  }
>() {}
```

### 8.2 Observability Integration

```typescript
import { Effect } from "effect"

// Add tracing to Effects
const tracedMarkDone = markChoreAsDone.pipe(
  Effect.withSpan("markChoreAsDone", {
    attributes: { instanceId, childId },
  }),
  Effect.tap(() =>
    Effect.logInfo("Chore marked as done", { instanceId, childId })
  ),
  Effect.tapError((error) =>
    Effect.logError("Failed to mark chore as done", { error })
  )
)
```

### 8.3 Phase 5 Deliverables

- [ ] Implement full service interfaces
- [ ] Add Effect-based logging
- [ ] Add tracing/spans for observability
- [ ] Migrate remaining mutations
- [ ] Performance optimization
- [ ] Complete documentation

---

## 9. Testing Strategy

### 9.1 Unit Tests for Effect Functions

```typescript
import { describe, it, expect } from "vitest"
import { Effect, Exit } from "effect"
import { calculateReward } from "./currency.effect"

describe("calculateReward", () => {
  it("returns 50% for bad quality", async () => {
    const result = await Effect.runPromise(
      calculateReward(1000, "bad", 100)
    )
    expect(result).toBe(500)
  })

  it("fails with invalid amount", async () => {
    const exit = await Effect.runPromiseExit(
      calculateReward(-100, "good", 100)
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
})
```

### 9.2 Testing with Mock Services

```typescript
import { Layer, Effect } from "effect"
import { DatabaseService } from "./adapter"

const mockDatabaseLayer = Layer.succeed(
  DatabaseService,
  {
    get: (id) => Effect.succeed(mockData[id] ?? null),
    insert: (table, doc) => Effect.succeed("mock-id"),
    patch: (id, patch) => Effect.void,
    delete: (id) => Effect.void,
    query: (table) => mockQueryBuilder,
  }
)

describe("markChoreAsDone", () => {
  it("fails when chore not found", async () => {
    const exit = await Effect.runPromiseExit(
      markChoreAsDone("nonexistent", "child1").pipe(
        Effect.provide(mockDatabaseLayer)
      )
    )

    expect(Exit.isFailure(exit)).toBe(true)
    // Check error type
  })
})
```

### 9.3 E2E Tests

E2E tests remain unchanged - they test the full stack behavior regardless of internal implementation.

---

## 10. Rollback Plan

### 10.1 Parallel Implementation

During migration, maintain both implementations:

```typescript
// Old implementation (to be removed)
export function calculateRewardLegacy(amount: number, quality: Quality): number {
  return Math.round(amount * COEFFICIENTS[quality])
}

// New Effect implementation
export const calculateReward = (amount: number, quality: Quality) =>
  Effect.succeed(Math.round(amount * COEFFICIENTS[quality]))

// Bridge for gradual migration
export function calculateRewardCompat(amount: number, quality: Quality): number {
  return Effect.runSync(calculateReward(amount, quality))
}
```

### 10.2 Feature Flags

```typescript
const USE_EFFECT_CHORE_LOGIC = false // Toggle per-feature

export const markDone = mutation({
  handler: async (ctx, args) => {
    if (USE_EFFECT_CHORE_LOGIC) {
      return runEffect(ctx, markChoreAsDoneEffect(args))
    }
    return markChoreAsDoneLegacy(ctx, args)
  }
})
```

### 10.3 Rollback Triggers

- Unit test failures > 5%
- E2E test failures
- Performance degradation > 20%
- Bundle size increase > 100KB
- Team unable to maintain code

---

## 11. Success Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Type coverage on errors | 0% | 100% | TSC analysis |
| Runtime validation errors | Manual review | Schema-based | Code audit |
| Test mock complexity | Module mocking | Service injection | Code review |
| Error handling consistency | Varied | Standardized | Code audit |
| Bundle size | Current | < +80KB | Build analysis |
| Build time | Current | < +10% | CI metrics |

---

## 12. Timeline Estimates

**Note:** These are rough estimates, not commitments.

| Phase | Scope | Complexity |
|-------|-------|------------|
| Phase 1 | Foundation & Schema | Low |
| Phase 2 | Utility Functions | Low |
| Phase 3 | Backend Logic | Medium-High |
| Phase 4 | Frontend Integration | Medium |
| Phase 5 | Advanced Patterns | High |

**Recommended approach:** Complete Phases 1-2 first, evaluate benefits, then decide on Phase 3+.

---

## Appendix A: Effect Learning Resources

1. **Official Documentation**: https://effect.website/docs
2. **Effect Days Talks**: https://www.youtube.com/@effect-ts
3. **Schema Guide**: https://effect.website/docs/schema
4. **Patterns Cookbook**: https://effect.website/docs/guides

## Appendix B: Key Effect Concepts

| Concept | Description |
|---------|-------------|
| `Effect<A, E, R>` | Computation returning `A`, failing with `E`, requiring `R` |
| `pipe()` | Left-to-right function composition |
| `Effect.gen` | Generator-based syntax (similar to async/await) |
| `Layer` | Dependency injection container |
| `Context.Tag` | Service interface definition |
| `Schema` | Runtime + compile-time type validation |
| `Data.TaggedError` | Typed, pattern-matchable errors |

---

## Appendix C: Decision Log

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| Start with Schema | Lowest risk, immediate value | Start with services |
| Convex adapter pattern | Convex controls execution | Direct Effect runtime |
| Gradual migration | Reduce risk, allow learning | Big bang rewrite |
| Keep legacy wrappers | Allow gradual adoption | Force immediate migration |
