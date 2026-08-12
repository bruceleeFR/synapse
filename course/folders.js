const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/folders.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'folders ' + new Date().toISOString() + '\n')
const MODULES = ['Start Here', 'Explore Your Brain', 'Meet JARVIS', 'It Adapts To You', 'Make It Yours']
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000)
  for (const name of MODULES) {
    // open course menu (the "..." near the course title, top of sidebar)
    await p.mouse.click(481, 158); await p.waitForTimeout(900)
    await p.getByText('Add folder', { exact: true }).click({ timeout: 6000 }); await p.waitForTimeout(1400)
    // fill the Name field in the Add folder dialog (floating label)
    await p.getByLabel('Name').fill(name, { timeout: 6000 }).catch(async () => { await p.locator('input:visible').last().fill(name) })
    await p.getByRole('button', { name: 'Add', exact: true }).click({ timeout: 6000 })
    await p.waitForTimeout(2500)
    log('created folder:', name)
  }
  await p.screenshot({ path: '/opt/synapse/course/folders_done.png' })
  const items = await p.evaluate(() => [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && e.textContent.trim().length < 30 && e.textContent.trim()).map(e => e.textContent.trim()))
  log('sidebar has:', JSON.stringify([...new Set(items)].filter(t => /Start Here|Explore|Meet JARVIS|Adapts|Make It|New page/.test(t))))
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
