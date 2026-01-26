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

test.describe('Chore Management', () => {
  test('parent can view chore templates', async ({ page }) => {
    await loginAsParent(page)

    // Navigate to chores page
    await page.goto('/chores')

    // Should see the seeded chore template
    await expect(page.getByText('Uklidit pokoj')).toBeVisible()
  })

  test('parent can create a new chore template', async ({ page }) => {
    await loginAsParent(page)

    await page.goto('/chores')

    // Click add button
    await page.getByRole('button', { name: /add|přidat|nový/i }).click()

    // Fill in chore details
    await page.getByLabel(/name|název/i).fill('Vynést koš')
    await page.getByLabel(/reward|odměna/i).fill('20')

    // Save
    await page.getByRole('button', { name: /add template|přidat/i }).click()

    // Verify it appears in the list
    await expect(page.getByText('Vynést koš')).toBeVisible()
  })
})
