const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/map.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'map ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000)
  // click the pencil (edit) on the right panel
  await p.mouse.click(1204, 197); await p.waitForTimeout(2500)
  const fields = await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('input,textarea,[contenteditable=true]')].map(e => ({ tag: e.tagName, ce: e.getAttribute('contenteditable'), ph: e.placeholder || '', aria: e.getAttribute('aria-label') || '', cls: (e.className || '').slice(0, 40) }))
    const btns = [...document.querySelectorAll('button')].map(x => x.textContent.trim()).filter(Boolean).slice(-14)
    return { inputs, btns }
  })
  log('EDITOR FIELDS:\n' + JSON.stringify(fields, null, 1))
  await p.screenshot({ path: '/opt/synapse/course/editor.png' })
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
