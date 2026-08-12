const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/cleanup.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'cleanup ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000)
  for (let i = 0; i < 10; i++) {
    const pos = await p.evaluate(() => {
      const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'New page')
      if (!t) return null
      t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.x, y: r.y + r.height / 2 }
    })
    if (!pos) { log('no more New page'); break }
    await p.mouse.move(336, pos.y); await p.waitForTimeout(500)
    await p.mouse.click(481, pos.y); await p.waitForTimeout(900)   // page "..." (far right column)
    // click a Delete menu item
    const del = p.getByText(/delete/i).first()
    if (await del.count() === 0) { log('no delete in menu at', i); await p.keyboard.press('Escape'); break }
    await del.click({ timeout: 5000 }); await p.waitForTimeout(1000)
    // confirm dialog
    const conf = p.getByRole('button', { name: /delete|confirm|yes/i }).last()
    if (await conf.count() > 0) { await conf.click({ timeout: 5000 }).catch(() => {}) }
    await p.waitForTimeout(2000)
    log('deleted a New page', i)
  }
  await p.screenshot({ path: '/opt/synapse/course/clean_done.png' })
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
