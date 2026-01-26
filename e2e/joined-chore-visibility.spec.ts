import { expect, test } from '@playwright/test'
import { resetAndSeedJoinedChoreData } from './helpers/test-setup'

test.describe('Joined Chore Visibility Bug', () => {
  test.beforeEach(async () => {
    await resetAndSeedJoinedChoreData()
  })

  test('joined chore remains visible to Kid B after Kid A marks done', async ({
    browser,
  }) => {
    // Open two browser contexts for two different kids
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    // Navigate both kids to their dashboards
    await pageA.goto('/kid/ANNA01')
    await pageB.goto('/kid/BEN001')

    // Verify both kids see their names
    await expect(pageA.getByRole('heading', { name: /anna/i })).toBeVisible()
    await expect(pageB.getByRole('heading', { name: /ben/i })).toBeVisible()

    // Verify both kids see the joined chore "Uklidit obývák"
    await expect(pageA.getByText('Uklidit obývák')).toBeVisible()
    await expect(pageB.getByText('Uklidit obývák')).toBeVisible()

    // Kid A marks the chore as done
    const markDoneButtonA = pageA
      .locator('article, [class*="card"], div')
      .filter({ hasText: 'Uklidit obývák' })
      .getByRole('button')
      .first()
    await markDoneButtonA.click()

    // Wait for the UI to update after marking done
    await pageA.waitForTimeout(1000)

    // Verify Kid A now sees the chore in completed section (status shows "Čeká na kontrolu")
    await expect(pageA.getByText('Čeká na kontrolu')).toBeVisible()

    // CRITICAL TEST: Kid B should STILL see the chore in their pending section
    // This is the bug - the chore should not disappear from Kid B's view
    await pageB.reload() // Force reload to get fresh data
    await expect(pageB.getByText('Uklidit obývák')).toBeVisible({
      timeout: 5000,
    })

    // The chore should show that Anna (Kid A) has completed her part
    // Ben should still see the checkmark button (not already marked done)
    const markDoneButtonB = pageB
      .locator('article, [class*="card"], div')
      .filter({ hasText: 'Uklidit obývák' })
      .getByRole('button')
      .first()
    await expect(markDoneButtonB).toBeEnabled()

    // Cleanup
    await contextA.close()
    await contextB.close()
  })

  test('both kids can independently mark joined chore as done', async ({
    browser,
  }) => {
    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()

    await pageA.goto('/kid/ANNA01')
    await pageB.goto('/kid/BEN001')

    // Both kids see the chore
    await expect(pageA.getByText('Uklidit obývák')).toBeVisible()
    await expect(pageB.getByText('Uklidit obývák')).toBeVisible()

    // Kid A marks done first
    const choreCardA = pageA
      .locator('article, [class*="card"], div')
      .filter({ hasText: 'Uklidit obývák' })
    await choreCardA.getByRole('button').first().click()

    // Wait for update
    await pageA.waitForTimeout(500)

    // Kid B marks done second
    await pageB.reload()
    await expect(pageB.getByText('Uklidit obývák')).toBeVisible()
    const choreCardB = pageB
      .locator('article, [class*="card"], div')
      .filter({ hasText: 'Uklidit obývák' })
    await choreCardB.getByRole('button').first().click()

    // Wait for updates
    await pageB.waitForTimeout(500)

    // Both should now see the chore as waiting for review
    await expect(pageA.getByText('Čeká na kontrolu')).toBeVisible()
    await expect(pageB.getByText('Čeká na kontrolu')).toBeVisible()

    await contextA.close()
    await contextB.close()
  })
})
