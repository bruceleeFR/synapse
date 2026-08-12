const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/sweep.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'sweep ' + new Date().toISOString() + '\n')
const COURSES = [
  ['Your Builder Identity', '01263d68'],
  ['Build Your AI Team', '60bb0f5a'],
  ['The Automation Engine', '049bbe4b'],
  ['Give Your AI a Memory', '7b91f2ee'],
  ['Own Your Machine', '540d46bd'],
  ['Jarvis Online', '1cba1fd1'],
  ['The Stark Protocol', '11d13ed4'],
  ['OpenClaw vs Hermes', '84eb2f1c'],
  ['Welcome to the Future', 'dbcfbda6'],
]
const NAV = /^(Classroom|Calendar|Members|Map|Leaderboards|About|Community|Home)$/
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 1300 })
  for (const [name, id] of COURSES) {
    try {
      await p.goto('https://www.skool.com/house-of-lamarca-/classroom/' + id, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {})
      await p.waitForTimeout(3800)
      // expand folders: click chevrons (small svg at far right of sidebar rows), bottom-up
      const chevs = await p.evaluate(() => {
        const out = []
        document.querySelectorAll('svg').forEach(s => { const r = s.getBoundingClientRect(); if (r.x > 466 && r.x < 494 && r.y > 205 && r.y < 1250 && r.width < 28) out.push(Math.round(r.y + r.height / 2)) })
        return [...new Set(out)]
      })
      for (const y of chevs.reverse()) { await p.mouse.click(481, y); await p.waitForTimeout(450) }
      await p.waitForTimeout(700)
      // collect leaf lesson rows
      const rows = await p.evaluate(() => {
        const seen = new Set(), out = []
        ;[...document.querySelectorAll('*')].forEach(e => {
          const r = e.getBoundingClientRect()
          if (e.children.length === 0 && r.x > 185 && r.x < 520 && r.y > 205 && r.y < 1260) {
            const t = e.textContent.trim()
            if (t && t.length < 70 && !seen.has(t)) { seen.add(t); out.push({ t, y: Math.round(r.y + r.height / 2), hasChev: false }) }
          }
        })
        // mark rows that have a chevron near them (folders) to skip clicking as lessons
        return out
      })
      let empties = [], drafts = []
      for (const row of rows) {
        if (NAV.test(row.t) || /%$/.test(row.t) || row.t === name || row.t.startsWith(name.slice(0, 14))) continue
        if (/\(Draft\)|\(Copy\)/i.test(row.t)) { drafts.push(row.t); continue }
        await p.mouse.click(300, row.y); await p.waitForTimeout(1000)
        const len = await p.evaluate(() => { const cards = [...document.querySelectorAll('div')].filter(d => { const r = d.getBoundingClientRect(); return r.x > 540 && r.width > 500 && r.height > 50 }); let best = ''; for (const c of cards) if (c.innerText.length > best.length) best = c.innerText; return best.length })
        if (len < 45) empties.push(row.t + ' (' + len + ')')
      }
      log('COURSE', name, '=> EMPTY:', JSON.stringify(empties), '| DRAFTS:', JSON.stringify(drafts))
    } catch (e) { log('COURSE', name, 'ERR', e.message.split('\n')[0]) }
  }
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
