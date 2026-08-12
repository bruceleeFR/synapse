const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/swap2.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'swap2 ' + new Date().toISOString() + '\n')
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
    card.scrollIntoView({ block: 'center' }); const r = card.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  await p.waitForTimeout(1200)
  await p.mouse.move(box.x + box.w / 2, box.y + 70); await p.waitForTimeout(900)
  // detect + click the edit pencil in the cover area
  const pen = await p.evaluate((bx) => {
    let hit = null
    document.querySelectorAll('button,[role=button]').forEach(e => { const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2; if (cx > bx.x && cx < bx.x + bx.w && cy > bx.y && cy < bx.y + 170 && r.width < 60) hit = { x: cx, y: cy } })
    return hit
  }, box)
  log('pencil', JSON.stringify(pen))
  await p.mouse.click(pen.x, pen.y); await p.waitForTimeout(1500)
  await p.getByText('Edit course', { exact: true }).click({ timeout: 6000 }); log('clicked Edit course')
  await p.waitForTimeout(2500)
  await p.screenshot({ path: '/opt/synapse/course/edit_modal.png' })
  // upload new cover
  await p.setInputFiles('input[type=file]', '/opt/synapse/course/jarvis-cover.png'); log('file set')
  await p.getByText('Crop new cover photo').waitFor({ timeout: 12000 }); log('crop up')
  await p.getByRole('button', { name: 'Save' }).last().click({ timeout: 8000 }); log('crop saved')
  await p.getByText('Crop new cover photo').waitFor({ state: 'detached', timeout: 10000 }).catch(() => log('crop still?'))
  await p.waitForTimeout(1500)
  // now click the Edit modal submit (only one Save remains)
  await p.getByRole('button', { name: 'Save' }).last().click({ timeout: 8000 }); log('modal saved')
  await p.waitForTimeout(4000)
  await p.screenshot({ path: '/opt/synapse/course/after_swap.png' })
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
