import { expect, test } from '@playwright/test'
import { seedReviewTestData } from './helpers/test-setup'
import type { Page } from '@playwright/test'

test.beforeEach(async () => {
  await seedReviewTestData()
})

async function loginAsParent(page: Page) {
  await page.goto('/login')
  // Click "Rodič" button to show PIN pad
  await page.getByRole('button', { name: /rodič/i }).click()
  // Enter PIN 1234
  await page.getByRole('button', { name: '1', exact: true }).click()
  await page.getByRole('button', { name: '2', exact: true }).click()
  await page.getByRole('button', { name: '3', exact: true }).click()
  await page.getByRole('button', { name: '4', exact: true }).click()
  // Click unlock button
  await page.getByRole('button', { name: /odemknout/i }).click()
  await expect(page).toHaveURL('/')
}

test.describe('Review Page', () => {
  test('shows chores awaiting review', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Should see all three test chores
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
    await expect(page.getByText('Vynést koš')).toBeVisible()
    await expect(page.getByText('Umýt nádobí')).toBeVisible()
  })

  test('displays correct reward for single chore', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Single chore (Uklidit pokoj - 10 Kč) should show total reward in header
    await expect(page.getByText('10.00 Kč').first()).toBeVisible()
  })

  test('displays correct reward for split chore (non-joined)', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Split chore (Vynést koš - 5 Kč per kid) should show "per kid" label
    await expect(page.getByText('per kid')).toBeVisible()

    // Total should be 5.00 Kč
    await expect(page.getByText('5.00 Kč').first()).toBeVisible()
  })

  test('displays correct reward for joined chore (pooled)', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Joined chore (Umýt nádobí - 20 Kč pooled) should show "pooled reward" label
    await expect(page.getByText('pooled reward')).toBeVisible()

    // Should show Joined badge
    await expect(page.getByText('Joined')).toBeVisible()

    // Total should be 20.00 Kč
    await expect(page.getByText('20.00 Kč')).toBeVisible()
  })

  test('can rate single chore with good quality', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Verify single chore exists before rating
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()

    // Click the good button (10.00 Kč) for the single chore
    // The single chore shows 10.00 Kč, 5.00 Kč, 12.50 Kč buttons
    await page.getByRole('button', { name: /10\.00 Kč/ }).first().click()

    // After rating single chore, it should disappear from the list
    // (since it has only one participant and is now completed)
    await expect(page.getByText('Uklidit pokoj')).not.toBeVisible({ timeout: 10000 })

    // The count should go from 3 to 2 awaiting review
    await expect(page.getByText('2 awaiting review')).toBeVisible()
  })

  test('shows Rate All button for multi-kid chores', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Both split and joined chores should have "Rate All at Once" button
    await expect(page.getByRole('button', { name: /Rate All/i }).first()).toBeVisible()
  })

  test('Rate All dialog shows correct calculations for joined chore', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // Click the second Rate All button (for joined chore - Umýt nádobí)
    // First one is for split chore (Vynést koš)
    await page.getByRole('button', { name: /Rate All/i }).nth(1).click()

    // Dialog should open
    await expect(page.getByText('Rate All Participants')).toBeVisible()

    // Should show total reward
    await expect(page.getByText('Total reward:')).toBeVisible()
    await expect(page.locator('[role="dialog"]').getByText('20.00 Kč')).toBeVisible()

    // Both Alice and Bob should be listed
    await expect(page.locator('[role="dialog"]').getByText('Alice')).toBeVisible()
    await expect(page.locator('[role="dialog"]').getByText('Bob')).toBeVisible()
  })

  test('quality coefficient affects reward display - buttons show bad/good/excellent amounts', async ({ page }) => {
    await loginAsParent(page)
    await page.goto('/review')

    // For single chore (10 Kč base reward), buttons should show:
    // Bad: 5.00 Kč (50%), Good: 10.00 Kč (100%), Excellent: 12.50 Kč (125%)

    // Check that the excellent button (12.50 Kč) is visible - this is unique
    await expect(page.getByText('12.50 Kč').first()).toBeVisible()

    // Check that good button (10.00 Kč) is visible
    await expect(page.getByText('10.00 Kč').first()).toBeVisible()

    // Check that bad button (5.00 Kč) is visible
    await expect(page.getByText('5.00 Kč').first()).toBeVisible()
  })
})
