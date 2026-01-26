# Testing Strategy

## Philosophy

Two testing layers only:

1. **Unit tests** - for pure, isolated logic (utilities, validators, calculations)
2. **E2E behavioral tests** - for everything else (user flows, database interactions, UI)

No integration test layer. If it touches the database or UI, test it through E2E.

---

## Layer 1: Unit Tests

### What to Unit Test

- Pure utility functions in `src/lib/`
- Validation logic
- Data transformation functions
- Calculation helpers (reward calculations, date logic)
- Formatting functions

### What NOT to Unit Test

- Convex mutations/queries (test via E2E)
- React components (test via E2E)
- Anything requiring database state

### Setup

Already installed: Vitest + Testing Library

```bash
bun run test        # run once
bun run test:watch  # watch mode
```

### Example Unit Tests

```typescript
// src/lib/rewards.test.ts
import { describe, test, expect } from 'vitest';
import { calculateReward, formatCurrency } from './rewards';

describe('calculateReward', () => {
  test('full reward for quality 5', () => {
    expect(calculateReward(100, 5)).toBe(100);
  });

  test('partial reward for quality 3', () => {
    expect(calculateReward(100, 3)).toBe(60);
  });

  test('no reward for quality 1', () => {
    expect(calculateReward(100, 1)).toBe(0);
  });
});

describe('formatCurrency', () => {
  test('formats with symbol', () => {
    expect(formatCurrency(1234, 'Kč')).toBe('1 234 Kč');
  });
});
```

```typescript
// src/lib/schedule.test.ts
import { describe, test, expect } from 'vitest';
import { getNextOccurrence, isChoreOverdue } from './schedule';

describe('getNextOccurrence', () => {
  test('daily schedule returns tomorrow', () => {
    const today = new Date('2025-01-15');
    const result = getNextOccurrence('daily', today);
    expect(result).toEqual(new Date('2025-01-16'));
  });

  test('weekly schedule returns next week same day', () => {
    const monday = new Date('2025-01-13'); // Monday
    const result = getNextOccurrence('weekly', monday);
    expect(result).toEqual(new Date('2025-01-20'));
  });
});

describe('isChoreOverdue', () => {
  test('returns true when past deadline', () => {
    const deadline = new Date('2025-01-10');
    const now = new Date('2025-01-15');
    expect(isChoreOverdue(deadline, now)).toBe(true);
  });
});
```

### Directory Structure

```
src/
├── lib/
│   ├── rewards.ts
│   ├── rewards.test.ts      # Co-located unit tests
│   ├── schedule.ts
│   ├── schedule.test.ts
│   ├── validation.ts
│   └── validation.test.ts
```

---

## Layer 2: E2E Behavioral Tests

### What to E2E Test

Test user-visible behavior, not implementation:

- "Parent can log in with PIN"
- "Parent can create a chore and assign it"
- "Child can see their assigned chores"
- "Child can mark a chore as done"
- "Parent can review and rate completed chores"
- "Balance updates after review"

### Setup

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html'], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'bun run preview',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### Directory Structure

```
e2e/
├── auth.spec.ts           # Login/logout flows
├── chores.spec.ts         # Chore CRUD
├── kid-view.spec.ts       # Kid-accessible pages
├── review.spec.ts         # Review workflow
└── helpers/
    └── test-setup.ts      # Database reset helpers
```

### Test Database Reset

Create a Convex mutation for test cleanup (guarded by environment variable):

```typescript
// convex/testing.ts
import { mutation } from "./_generated/server";

export const resetDatabase = mutation({
  args: {},
  handler: async (ctx) => {
    // Only allow in test environment
    const isTest = process.env.IS_TEST === "true";
    if (!isTest) {
      throw new Error("resetDatabase only allowed in test environment");
    }

    const tables = ["settings", "children", "choreTemplates",
                    "scheduledChores", "choreInstances", "withdrawals"];

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      await Promise.all(docs.map(doc => ctx.db.delete(doc._id)));
    }
  },
});

export const seedTestData = mutation({
  args: {},
  handler: async (ctx) => {
    const isTest = process.env.IS_TEST === "true";
    if (!isTest) {
      throw new Error("seedTestData only allowed in test environment");
    }

    // Create test PIN (1234)
    await ctx.db.insert("settings", {
      pinHash: "hashed_1234", // Use actual hash
      currencySymbol: "Kč",
      sessionDurationHours: 24,
    });

    // Create test child
    await ctx.db.insert("children", {
      name: "Test Child",
      accessCode: "TEST123",
      balance: 0,
    });
  },
});
```

### E2E Test Helper

```typescript
// e2e/helpers/test-setup.ts
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";

// Local backend URL (from convex dev --local, runs on port 3210)
const convexUrl = process.env.VITE_CONVEX_URL || "http://127.0.0.1:3210";

export async function resetAndSeedDatabase() {
  const client = new ConvexHttpClient(convexUrl);
  await client.mutation(api.testing.resetDatabase, {});
  await client.mutation(api.testing.seedTestData, {});
}
```

### Example E2E Tests

```typescript
// e2e/auth.spec.ts
import { test, expect } from '@playwright/test';
import { resetAndSeedDatabase } from './helpers/test-setup';

test.beforeEach(async () => {
  await resetAndSeedDatabase();
});

test('parent can log in with correct PIN', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button', { name: '1' }).click();
  await page.getByRole('button', { name: '2' }).click();
  await page.getByRole('button', { name: '3' }).click();
  await page.getByRole('button', { name: '4' }).click();

  await expect(page).toHaveURL('/');
});

test('wrong PIN shows error', async ({ page }) => {
  await page.goto('/login');

  await page.getByRole('button', { name: '9' }).click();
  await page.getByRole('button', { name: '9' }).click();
  await page.getByRole('button', { name: '9' }).click();
  await page.getByRole('button', { name: '9' }).click();

  await expect(page.getByText(/nesprávný|incorrect/i)).toBeVisible();
});
```

```typescript
// e2e/chores.spec.ts
import { test, expect } from '@playwright/test';
import { resetAndSeedDatabase } from './helpers/test-setup';

test.beforeEach(async () => {
  await resetAndSeedDatabase();
});

test('parent can create a new chore', async ({ page }) => {
  // Login first
  await page.goto('/login');
  await page.getByRole('button', { name: '1' }).click();
  await page.getByRole('button', { name: '2' }).click();
  await page.getByRole('button', { name: '3' }).click();
  await page.getByRole('button', { name: '4' }).click();
  await expect(page).toHaveURL('/');

  // Navigate to chores
  await page.goto('/chores');

  // Create chore
  await page.getByRole('button', { name: /add|přidat/i }).click();
  await page.getByLabel(/name|název/i).fill('Uklidit pokoj');
  await page.getByLabel(/reward|odměna/i).fill('50');
  await page.getByRole('button', { name: /save|uložit/i }).click();

  // Verify it appears
  await expect(page.getByText('Uklidit pokoj')).toBeVisible();
});
```

```typescript
// e2e/kid-view.spec.ts
import { test, expect } from '@playwright/test';
import { resetAndSeedDatabase } from './helpers/test-setup';

test.beforeEach(async () => {
  await resetAndSeedDatabase();
});

test('child can view their chores via access code', async ({ page }) => {
  await page.goto('/kid/TEST123');

  // Page should be in Czech
  await expect(page.getByText(/úkoly|chores/i)).toBeVisible();
});

test('invalid access code shows error', async ({ page }) => {
  await page.goto('/kid/INVALID');

  await expect(page.getByText(/nenalezeno|not found/i)).toBeVisible();
});
```

---

## Local Convex Backend for E2E

Use Convex's built-in local backend (`--local` flag) everywhere - both locally and in CI:

```bash
# Terminal 1: Start local Convex
bunx convex dev --local

# Terminal 2: Start app
bun run dev

# Terminal 3: Run E2E tests
bunx playwright test
```

The `--local` flag runs the open-source Convex backend as a subprocess:
- Backend runs on `http://127.0.0.1:3210`
- Data stored in `~/.convex/`
- Dashboard available at `http://localhost:6790`
- Stops when `convex dev` stops

---

## CI Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, master]
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run lint

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run test

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [lint, unit-tests]
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Install Playwright
        run: bunx playwright install --with-deps chromium

      - name: Start local Convex backend
        run: |
          bunx convex dev --local --once
          bunx convex env set IS_TEST true --local

      - name: Build app
        run: bun run build

      - name: Run E2E tests
        run: |
          # Start local backend in background for tests
          bunx convex dev --local &
          sleep 5
          bunx playwright test

      - name: Upload report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

---

## Summary

| Layer | Tool | What to Test | When to Run |
|-------|------|--------------|-------------|
| Unit | Vitest | Pure functions, utilities, calculations | Always, fast |
| E2E | Playwright | User behaviors, flows, database interactions | CI, before deploy |

**Rule of thumb:**
- Can you test it without a database or browser? → Unit test
- Everything else → E2E test

---

## Resources

- [Convex Local Deployments](https://docs.convex.dev/cli/local-deployments) - `convex dev --local` documentation
- [Playwright Docs](https://playwright.dev/docs/intro)
- [Vitest Docs](https://vitest.dev/)
