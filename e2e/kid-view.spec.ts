import { expect, test } from '@playwright/test'
import { resetAndSeedDatabase } from './helpers/test-setup'

test.beforeEach(async () => {
  await resetAndSeedDatabase()
})

test.describe('Kid View', () => {
  test('child can access their view with valid access code', async ({
    page,
  }) => {
    await page.goto('/kid/TEST123')

    // Page should load with child's name visible
    await expect(page.getByRole('heading', { name: /test child/i })).toBeVisible()
  })

  test('invalid access code shows error', async ({ page }) => {
    await page.goto('/kid/INVALID')

    // Should show error message in Czech "Přístupový kód nenalezen"
    await expect(page.getByText(/přístupový kód nenalezen/i)).toBeVisible()
  })

  test('kid view shows balance', async ({ page }) => {
    await page.goto('/kid/TEST123')

    // Should show balance (0 Kč for test child)
    await expect(page.getByText(/0.*Kč|Kč.*0/)).toBeVisible()
  })
})
