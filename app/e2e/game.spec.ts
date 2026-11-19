import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/?e2e')
}
const node = (page: Page, label: string) => page.locator(`g.machine[aria-label^="${label}"]`)

test('landing: one Play button, straight into a running sandbox', async ({ page }) => {
  await open(page)
  await expect(page.getByRole('heading', { name: /See how systems/ })).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible()
  // nothing is locked and there is no lesson or quiz anywhere
  await expect(page.getByRole('button', { name: 'Add Sharded Database' })).toBeEnabled()
  await expect(page.getByText(/lesson|quiz|Codex/i)).toHaveCount(0)
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.locator('.tile-value').first()).not.toHaveText('–', { timeout: 10_000 })
})

test('sandbox: build, break it with chaos, and open a challenge', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await page.getByRole('button', { name: 'Add Cache' }).click()
  await node(page, 'App Server').click()
  await page.getByRole('button', { name: 'Connect to…' }).click()
  await node(page, 'Cache').click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lose a region' }).click()
  await expect(page.getByText('Chaos event: Region outage').first()).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Challenges' }).click()
  await page.getByRole('listitem').filter({ hasText: 'Tutorial' }).getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('heading', { name: /Tutorial/ })).toBeVisible()
})

test('every challenge can be shipped from its reference design', async ({ page }) => {
  await open(page)
  const ids: string[] = await page.evaluate(() => (window as any).__levels.map((l: { id: string }) => l.id))
  expect(ids).toHaveLength(11)
  for (const id of ids) {
    await page.evaluate((id) => {
      const g = (window as any).__game
      const level = (window as any).__levels.find((l: { id: string }) => l.id === id)
      g.setState({ designs: { ...g.getState().designs, [id]: JSON.parse(JSON.stringify(level.reference)) } })
      g.getState().enterLevel(id)
    }, id)
    await page.getByRole('button', { name: '4×' }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByText('Shipped!'), id).toBeVisible({ timeout: 60_000 })
  }
  await page.getByRole('button', { name: 'See debrief' }).click()
  await expect(page.getByText('Replay of your run')).toBeVisible()
})

test('keyboard only: build and run with the command palette', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  for (const cmd of ['add cache', 'connect app to cache', 'start']) {
    await page.keyboard.press('/')
    await page.getByRole('dialog', { name: 'Command palette' }).waitFor()
    await page.keyboard.type(cmd)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
  }
  await expect(page.locator('.tile-value').first()).not.toHaveText('–', { timeout: 10_000 })
  await expect(page.getByRole('region', { name: 'Design description' })).toContainText('app sends requests to cache')
})

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload()
  await page.waitForTimeout(500)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('interview mode scores a design against the rubric', async ({ page }) => {
  await open(page)
  await page.evaluate(() => {
    const g = (window as any).__game
    const ref = (window as any).__levels.find((l: { id: string }) => l.id === 'boss').reference
    g.setState({ designs: { ...g.getState().designs, interview: JSON.parse(JSON.stringify(ref)) } })
    g.getState().enterLevel('interview')
  })
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: '4×' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText(/Interview score: \d+\/100/)).toBeVisible({ timeout: 60_000 })
})
