const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/reorder.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'reorder ' + new Date().toISOString() + '\n')
const TITLES = ['Welcome to the Future', 'CLAUDE CODE', 'Your Builder Identity', 'Build Your AI Team', 'The Automation Engine', 'Give Your AI a Memory', 'Own Your Machine', 'Jarvis Online', 'The Stark Protocol', 'OpenClaw vs Hermes', 'Build Your JARVIS']
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 1200 })
  for (let step = 0; step < 12; step++) {
    await p.goto('https://www.skool.com/house-of-lamarca-/classroom', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
    await p.waitForTimeout(3800)
    const info = await p.evaluate((titles) => {
      const found = []
      for (const t of titles) {
        const el = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim().startsWith(t.slice(0, 16)))
        if (el) { const r = el.getBoundingClientRect(); found.push({ t, y: r.y, x: r.x }) }
      }
      found.sort((a, b) => (a.y - b.y) || (a.x - b.x))
      const order = found.map(f => f.t)
      const idx = order.findIndex(t => t.startsWith('Build Your JARVIS'))
      // box of the JARVIS card
      const jt = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Build Your JARVIS')
      let box = null
      if (jt) { let el = jt; for (let i = 0; i < 6 && el; i++) { const r = el.getBoundingClientRect(); if (r.width > 300 && r.height > 200) { el.scrollIntoView({ block: 'center' }); const rr = el.getBoundingClientRect(); box = { x: rr.x, y: rr.y, w: rr.width, h: rr.height }; break } el = el.parentElement } }
      return { idx, order, box }
    }, TITLES)
    log('step', step, 'index', info.idx, '| order', JSON.stringify(info.order.map(t => t.slice(0, 10))))
    if (info.idx <= 1) { log('reached position', info.idx + 1); break }
    if (!info.box) { log('no box'); break }
    await p.waitForTimeout(800)
    // hover card, open its "..." menu (top-right), click Move left
    await p.mouse.move(info.box.x + info.box.w / 2, info.box.y + 70); await p.waitForTimeout(800)
    const pen = await p.evaluate((bx) => { let hit = null; document.querySelectorAll('button,[role=button]').forEach(e => { const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; if (cx > bx.x && cx < bx.x + bx.w && cy > bx.y && cy < bx.y + 170 && r.width < 60) hit = { x: cx, y: cy } }); return hit }, info.box)
    if (!pen) { log('no menu btn'); break }
    await p.mouse.click(pen.x, pen.y); await p.waitForTimeout(1200)
    await p.screenshot({ path: '/opt/synapse/course/reorder_menu.png' })
    let mv = p.locator(':text-is("Move ←")').first()
    if (await mv.count() === 0) mv = p.locator(':text-is("Move left")').first()
    if (await mv.count() === 0) { log('no move item'); break }
    await mv.click({ timeout: 5000 }); await p.waitForTimeout(2500)
    log('moved left once')
  }
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(3500)
  await p.screenshot({ path: '/opt/synapse/course/reordered.png' })
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
