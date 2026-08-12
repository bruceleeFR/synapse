const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/fmenu.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'fmenu ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000)
  // hover the Start Here folder row
  const box = await p.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Start Here')
    const row = t.closest('div'); const r = (row || t).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  log('row', JSON.stringify(box))
  await p.mouse.move(box.x + box.w / 2, box.y + box.h / 2); await p.waitForTimeout(900)
  await p.screenshot({ path: '/opt/synapse/course/folder_hover.png' })
  // dump buttons in the row area
  const btns = await p.evaluate((bx) => {
    const out = []
    document.querySelectorAll('button,[role=button],svg').forEach(e => {
      const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2
      if (cx > bx.x && cx < bx.x + bx.w + 40 && Math.abs(cy - (bx.y + bx.h / 2)) < 30 && r.width < 50)
        out.push({ t: (e.getAttribute('aria-label') || e.textContent.trim() || e.tagName).slice(0, 18), x: Math.round(cx), y: Math.round(cy) })
    })
    return out
  }, box)
  log('row controls', JSON.stringify(btns))
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
