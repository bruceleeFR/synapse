const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/cover.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'cover ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 1000 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4500); log('classroom')
  // find the Build Your JARVIS card and scroll to it
  const box = await p.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Build Your JARVIS')
    if (!t) return null
    const card = t.closest('a') || t.closest('[class]')
    const c = (card || t).getBoundingClientRect()
    // find the whole card (walk up until a big block)
    let el = t, best = t
    for (let i = 0; i < 6 && el; i++) { const r = el.getBoundingClientRect(); if (r.width > 300 && r.height > 200) { best = el; break } el = el.parentElement }
    const r = best.getBoundingClientRect()
    best.scrollIntoView({ block: 'center' })
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  log('card box', JSON.stringify(box))
  await p.waitForTimeout(1000)
  if (box) { await p.mouse.move(box.x + box.w / 2, box.y + 60); await p.waitForTimeout(900) }
  await p.screenshot({ path: '/opt/synapse/course/card_hover.png' })
  // dump any edit/pencil controls near the card
  const ctrls = await p.evaluate(() => {
    const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Build Your JARVIS')
    let el = t, card = t
    for (let i = 0; i < 6 && el; i++) { const r = el.getBoundingClientRect(); if (r.width > 300 && r.height > 200) { card = el; break } el = el.parentElement }
    const btns = [...card.querySelectorAll('button,svg,[role=button]')].map(e => (e.getAttribute('aria-label') || e.textContent.trim() || e.tagName).slice(0, 24))
    return btns
  })
  log('card controls', JSON.stringify(ctrls))
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
