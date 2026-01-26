import { expect, test } from '@playwright/test'
import { resetAndSeedDatabase } from './helpers/test-setup'
import type { Page } from '@playwright/test'

test.beforeEach(async () => {
  await resetAndSeedDatabase()
})

async function loginAsParent(page: Page) {
  await page.goto('/login')
  // Click "Rodič" button to show PIN pad
  await page.getByRole('button', { name: /rodič/i }).click()
  // Enter PIN 1234
  await page.getByRole('button', { name: '1' }).click()
  await page.getByRole('button', { name: '2' }).click()
  await page.getByRole('button', { name: '3' }).click()
  await page.getByRole('button', { name: '4' }).click()
  // Click unlock button
  await page.getByRole('button', { name: /odemknout/i }).click()
  await expect(page).toHaveURL('/')
}

test.describe('Review Storage', () => {
  test('quality rating is stored and shown on kid detail page after review', async ({
    page,
  }) => {
    // Step 1: Kid marks chore as done
    await page.goto('/kid/TEST123')
    await expect(page.getByRole('heading', { name: /test child/i })).toBeVisible()

    // Find the chore and mark it as done
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
    const doneButton = page.locator('button').filter({ has: page.locator('svg.lucide-check') }).first()
    await doneButton.click()

    // Wait for the done state to be reflected
    await expect(page.getByText(/čeká na kontrolu/i)).toBeVisible({ timeout: 5000 })

    // Step 2: Parent logs in and reviews the chore
    await loginAsParent(page)
    await page.goto('/review')

    // Should see the chore awaiting review
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
    await expect(page.getByText('Ready')).toBeVisible()

    // Click the "Good" rating button (thumbs up)
    const goodButton = page.locator('button').filter({ hasText: /50.*Kč/i }).filter({ has: page.locator('svg.lucide-thumbs-up') })
    await goodButton.click()

    // Wait for the rating to be processed
    await expect(page.getByText('No chores to review')).toBeVisible({ timeout: 5000 })

    // Step 3: Navigate to kid detail page and verify quality is shown
    await page.goto('/children')
    await page.getByText('Test Child').click()

    // Go to History tab
    await page.getByRole('tab', { name: /history/i }).click()

    // Verify the quality badge shows "good" instead of "N/A"
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
    const qualityBadge = page.locator('[class*="badge"]').filter({ hasText: /good|N\/A/i })
    await expect(qualityBadge).toHaveText('good')
    // Ensure it does NOT show N/A
    await expect(page.getByText('N/A')).not.toBeVisible()
  })

  test('quality rating is shown on kid view after review', async ({
    page,
  }) => {
    // Step 1: Kid marks chore as done
    await page.goto('/kid/TEST123')
    await expect(page.getByRole('heading', { name: /test child/i })).toBeVisible()

    // Find the chore and mark it as done
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
    const doneButton = page.locator('button').filter({ has: page.locator('svg.lucide-check') }).first()
    await doneButton.click()

    // Wait for the done state
    await expect(page.getByText(/čeká na kontrolu/i)).toBeVisible({ timeout: 5000 })

    // Step 2: Parent reviews with "excellent" rating
    await loginAsParent(page)
    await page.goto('/review')

    await expect(page.getByText('Uklidit pokoj')).toBeVisible()

    // Click the "Excellent" rating button (star)
    const excellentButton = page.locator('button').filter({ hasText: /62.*Kč/i }).filter({ has: page.locator('svg.lucide-star') })
    await excellentButton.click()

    // Wait for rating to complete
    await expect(page.getByText('No chores to review')).toBeVisible({ timeout: 5000 })

    // Step 3: Go back to kid view and verify quality is shown
    await page.goto('/kid/TEST123')

    // The completed chore should show "Výborně" (Excellent in Czech)
    await expect(page.getByText('Výborně')).toBeVisible()
    // The earned reward should be shown (+62.50 Kč for excellent)
    await expect(page.getByText(/62.*Kč/)).toBeVisible()
  })
})
