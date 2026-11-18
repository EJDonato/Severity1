import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const ALL_LESSONS = ['client-server', 'latency', 'db-storage', 'load-balancing', 'caching', 'replication', 'cdn-dns', 'async', 'search', 'sharding', 'rate-limiting', 'redundancy']

async function open(page: Page) {
  await page.goto('/?e2e')
  await page.getByText('No thanks').click()
}
const node = (page: Page, label: string) => page.locator(`g.machine[aria-label^="${label}"]`)

async function lesson(page: Page, pick: number) {
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('.options .btn').nth(pick).click()
  await page.getByRole('button', { name: 'Finish lesson' }).click()
}

test('tutorial: learn, build, run, ship, debrief', async ({ page }) => {
  await open(page)
  await page.getByText('Start lesson').first().click()
  await lesson(page, 0)
  await page.getByRole('button', { name: 'Next lesson' }).click()
  await lesson(page, 1)
  await page.getByRole('button', { name: 'Start the level' }).click()
  await page.getByRole('button', { name: 'Add Users' }).click()
  await page.getByRole('button', { name: 'Add App Server' }).click()
  await node(page, 'Users').click()
  await page.getByRole('button', { name: 'Connect to…' }).click()
  await node(page, 'App Server').click()
  await page.getByRole('button', { name: '4×' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText('Shipped!')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'See debrief' }).click()
  await expect(page.getByText('Replay of your run')).toBeVisible()
})

test('every level can be shipped from its reference design', async ({ page }) => {
  await open(page)
  const ids: string[] = await page.evaluate(() => (window as any).__levels.map((l: { id: string }) => l.id))
  expect(ids).toHaveLength(11)
  for (const id of ids) {
    await page.evaluate(({ id, lessons }) => {
      const g = (window as any).__game
      const level = (window as any).__levels.find((l: { id: string }) => l.id === id)
      g.setState({ lessonsDone: lessons, designs: { ...g.getState().designs, [id]: JSON.parse(JSON.stringify(level.reference)) } })
      g.getState().enterLevel(id)
    }, { id, lessons: ALL_LESSONS })
    await page.getByRole('button', { name: '4×' }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByText('Shipped!'), id).toBeVisible({ timeout: 60_000 })
  }
})

test('keyboard only: build and run with the command palette', async ({ page }) => {
  await open(page)
  await page.evaluate(() => (window as any).__game.getState().enterLevel('sandbox'))
  for (const cmd of ['add users', 'add app server', 'connect users to app', 'start']) {
    await page.keyboard.press('/')
    await page.getByRole('dialog', { name: 'Command palette' }).waitFor()
    await page.keyboard.type(cmd)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
  }
  await expect(page.locator('.tile-value').first()).not.toHaveText('–', { timeout: 10_000 })
  await expect(page.getByRole('region', { name: 'Design description' })).toContainText('users sends requests to app')
})

test('works offline once loaded', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // let the worker take control and fill its cache
  await page.waitForTimeout(500)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /See how systems/ })).toBeVisible()
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
