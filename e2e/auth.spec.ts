import { expect, test } from '@playwright/test'
import { resetAndSeedDatabase } from './helpers/test-setup'

test.beforeEach(async () => {
  await resetAndSeedDatabase()
})

test.describe('Parent Authentication', () => {
  test('parent can log in with correct PIN', async ({ page }) => {
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

    // Should redirect to dashboard
    await expect(page).toHaveURL('/')
  })

  test('wrong PIN shows error', async ({ page }) => {
    await page.goto('/login')

    // Click "Rodič" button to show PIN pad
    await page.getByRole('button', { name: /rodič/i }).click()

    // Enter wrong PIN 9999
    await page.getByRole('button', { name: '9' }).click()
    await page.getByRole('button', { name: '9' }).click()
    await page.getByRole('button', { name: '9' }).click()
    await page.getByRole('button', { name: '9' }).click()

    // Click unlock button
    await page.getByRole('button', { name: /odemknout/i }).click()

    // Should show error message (in Czech) or shake animation
    // The PIN pad stays visible with an error state
    await expect(page.getByText(/Nesprávný PIN/i)).toBeVisible()
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Try to access protected route
    await page.goto('/chores')

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/)
  })
})
