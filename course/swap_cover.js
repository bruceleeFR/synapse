const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/swap.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'swap ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 1000 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4500)
  const box = await p.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Build Your JARVIS')
    let el = t, card = t
    for (let i = 0; i < 6 && el; i++) { const r = el.getBoundingClientRect(); if (r.width > 300 && r.height > 200) { card = el; break } el = el.parentElement }
    card.scrollIntoView({ block: 'center' })
    const r = card.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  await p.waitForTimeout(1200); log('card', JSON.stringify(box))
  // hover the cover image (top part of card)
  await p.mouse.move(box.x + box.w / 2, box.y + 70); await p.waitForTimeout(1000)
  await p.screenshot({ path: '/opt/synapse/course/hover2.png' })
  // dump clickable elements whose center sits over the card image area
  const cands = await p.evaluate((bx) => {
    const out = []
    document.querySelectorAll('button,svg,[role=button]').forEach(e => {
      const r = e.getBoundingClientRect()
      const cx = r.x + r.width / 2, cy = r.y + r.height / 2
      if (cx > bx.x && cx < bx.x + bx.w && cy > bx.y && cy < bx.y + 170 && r.width < 60) {
        out.push({ t: (e.getAttribute('aria-label') || e.textContent.trim() || e.tagName).slice(0, 20), x: Math.round(cx), y: Math.round(cy) })
      }
    })
    return out
  }, box)
  log('cover-area controls', JSON.stringify(cands))
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
