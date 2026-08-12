const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/inspect.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'inspect ' + new Date().toISOString() + '\n')
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000); log('course loaded')
  // hover the left sidebar area to reveal add controls
  await p.mouse.move(336, 250); await p.waitForTimeout(600)
  // click the course "..." menu (near the title)
  const dots = p.locator('svg, button').filter({ hasText: '' })
  // dump all buttons text + aria
  const controls = await p.evaluate(() => {
    const out = []
    document.querySelectorAll('button,[role=button],[role=menuitem],a').forEach(e => {
      const t = (e.textContent || '').trim().slice(0, 30); const al = e.getAttribute('aria-label') || ''
      if (t || al) out.push((t || '[icon]') + (al ? ' aria:' + al : ''))
    })
    return [...new Set(out)]
  })
  log('CONTROLS:\n' + controls.join('\n'))
  await p.screenshot({ path: '/opt/synapse/course/course_view.png' })
  // try clicking the "..." next to course title
  await p.evaluate(() => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Build Your JARVIS'); if (t) { const row = t.closest('div'); const btn = row && row.parentElement && row.parentElement.querySelector('button, svg'); } })
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
