import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function open(page: Page) {
  await page.goto('/?e2e')
}
const node = (page: Page, label: string) => page.locator(`g.machine[aria-label^="${label}"]`)

async function openSandbox(page: Page) {
  await page.getByRole('button', { name: /open the sandbox/ }).click()
  await expect(page.getByRole('heading', { name: 'Sandbox', exact: true })).toBeVisible()
}

test('Play starts the game: welcome, a first run, then one new problem with the design carried over', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Welcome to Friendbook' })).toBeVisible()
  await page.getByRole('button', { name: 'Start the first day' }).click()
  await expect(page.getByRole('heading', { name: 'Launch day' })).toBeVisible()
  await expect(page.getByText('Stage 1 of 11')).toBeVisible()
  await expect(page.getByText(/sandbox/i)).toHaveCount(0)
  for (const part of ['Users', 'App Server', 'Database']) await expect(node(page, part)).toBeVisible()
  await expect(page.getByRole('button', { name: /Object Storage, locked until stage 2/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Monitoring, locked until stage 10/ })).toBeDisabled()
  await page.getByRole('button', { name: '4×' }).click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText('Stage cleared!')).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: /Next problem/ }).click()
  await expect(page.getByRole('dialog', { name: 'Photos arrive' })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('New part unlocked')).toBeVisible()
  await expect(page.getByRole('dialog').getByText('A store for big files.')).toBeVisible()
  await page.getByRole('button', { name: "Let's go" }).click()
  await expect(page.getByText('Stage 2 of 11')).toBeVisible()
  for (const part of ['Users', 'App Server', 'Database']) await expect(node(page, part)).toBeVisible()
  await expect(page.locator('g.ghost')).toHaveCount(0) // no outline of the answer
  await expect(page.getByRole('button', { name: 'Add Object Storage' })).toBeVisible()
})

test('sandbox: build, break it with chaos, and open a stage', async ({ page }) => {
  await open(page)
  await openSandbox(page)
  await page.getByRole('button', { name: 'Add Cache' }).click()
  await node(page, 'App Server').click()
  await page.getByRole('button', { name: 'Connect to…' }).click()
  await node(page, 'Cache').click()
  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await page.getByRole('button', { name: 'Lose a region' }).click()
  await expect(page.getByText('Chaos event: Region outage').first()).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Stages' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Photos arrive' }).getByRole('button')).toHaveCount(0) // locked until stage 1 is solved
  await page.getByRole('listitem').filter({ hasText: 'Launch day' }).getByRole('button', { name: 'Play' }).click()
  await page.getByRole('button', { name: 'Start the first day' }).click()
  await expect(page.getByRole('heading', { name: 'Launch day' })).toBeVisible()
})

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await page.mouse.up()
}
const centre = (b: { x: number; y: number; width: number; height: number }) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

test('drag and drop: drag a card onto the board, move it, wire it up, delete it', async ({ page }) => {
  await open(page)
  await openSandbox(page)
  const board = (await page.locator('.board svg').boundingBox())!
  const card = (await page.getByRole('button', { name: 'Add Cache' }).boundingBox())!
  // 1. card -> board
  await drag(page, centre(card), { x: board.x + board.width * 0.7, y: board.y + board.height * 0.85 })
  const cache = node(page, 'Cache')
  await expect(cache).toBeVisible()
  // 2. move the part somewhere else
  const before = (await cache.boundingBox())!
  await drag(page, centre(before), { x: centre(before).x - 220, y: centre(before).y - 110 })
  const after = (await cache.boundingBox())!
  expect(Math.abs(after.x - before.x)).toBeGreaterThan(100)
  // 3. drag from the app server's handle to the cache
  const port = (await node(page, 'App Server').locator('.port circle').last().boundingBox())!
  await drag(page, centre(port), centre(after))
  await expect(page.getByRole('region', { name: 'Design description' })).toContainText('app sends requests to cache')
  // 4. select the part and delete it
  await cache.click()
  await page.keyboard.press('Delete')
  await expect(cache).toHaveCount(0)
})

test('dragging a wire onto a part that cannot accept it explains why', async ({ page }) => {
  await open(page)
  await openSandbox(page)
  const port = (await node(page, 'Users').locator('.port circle').last().boundingBox())!
  const db = (await node(page, 'Database').boundingBox())!
  await drag(page, centre(port), centre(db))
  await expect(page.getByText(/Users should never talk to the Database/)).toBeVisible()
})

test('every stage can be cleared from its reference design', async ({ page }) => {
  await open(page)
  const ids: string[] = await page.evaluate(() => (window as any).__levels.map((l: { id: string }) => l.id))
  expect(ids).toHaveLength(11)
  for (const id of ids) {
    await page.evaluate((id) => {
      const g = (window as any).__game
      const level = (window as any).__levels.find((l: { id: string }) => l.id === id)
      g.setState({ introSeen: (window as any).__levels.map((l: { id: string }) => l.id), designs: { ...g.getState().designs, [id]: JSON.parse(JSON.stringify(level.reference)) } })
      g.getState().enterLevel(id)
    }, id)
    await page.getByRole('button', { name: '4×' }).click()
    await page.getByRole('button', { name: 'Start', exact: true }).click()
    await expect(page.getByText(/Stage cleared!|Friendbook survived!/), id).toBeVisible({ timeout: 60_000 })
  }
  await page.getByRole('button', { name: 'See debrief' }).click()
  await expect(page.getByText('Replay of your run')).toBeVisible()
})

test('keyboard only: build and run with the command palette', async ({ page }) => {
  await open(page)
  await openSandbox(page)
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
