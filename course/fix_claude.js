const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/fixclaude.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'fixclaude ' + new Date().toISOString() + '\n')
const URL = 'https://www.skool.com/house-of-lamarca-/classroom/7ae572c5'
const BODY = [
  'A skill is a superpower you teach Claude once, and it uses it forever. That is why skills are the future of working with AI.',
  'A Claude Skill is a small folder of instructions and files that Claude loads only when it is relevant. Instead of explaining your process every time, you package it once. Claude then follows your steps, your standards and your tone, on demand.',
  'Why it changes everything: a generic prompt gives you a generic answer. A skill gives you your answer, the way your business actually does it. Skills stack, so your Claude gets sharper every week as you add more.',
  'Examples: a skill that audits a website for AI search, a skill that writes your client reports in your exact format, a skill that turns a call into tasks. Each one is reusable, shareable and versioned.',
  'BUILD: think of one task you explain to people over and over. That is your first skill. Write the steps down now, and in the next lessons you will turn it into a real Claude Skill.',
]
;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 1000 })
  await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000)

  // 1) delete the stray draft copy
  try {
    const y = await p.evaluate(() => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim().startsWith('(Draft) (Copy)')); if (!t) return null; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return r.y + r.height / 2 })
    if (y) {
      await p.mouse.move(336, y); await p.waitForTimeout(500)
      await p.mouse.click(481, y); await p.waitForTimeout(900)
      await p.getByText(/^delete/i).first().click({ timeout: 5000 }); await p.waitForTimeout(1000)
      const conf = p.getByRole('button', { name: /delete|confirm|yes/i }).last()
      if (await conf.count()) await conf.click({ timeout: 5000 }).catch(() => {})
      await p.waitForTimeout(2500); log('deleted draft copy')
    } else log('draft copy not found')
  } catch (e) { log('delete err', e.message.split('\n')[0]) }

  // 2) fill the empty lesson "What Are Claude Skills..."
  try {
    const y = await p.evaluate(() => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim().startsWith('What Are Claude Skills')); if (!t) return null; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return r.y + r.height / 2 })
    if (!y) { log('lesson not found'); await b.close(); return }
    await p.mouse.click(300, y); await p.waitForTimeout(1500)
    await p.mouse.click(1204, 197); await p.waitForTimeout(1800)   // pencil edit
    const hasTitle = await p.evaluate(() => !!document.querySelector('input[placeholder="Title"]'))
    log('editor open, title field:', hasTitle)
    const ed = p.locator('.tiptap.ProseMirror').first()
    await ed.click({ timeout: 6000 })
    await p.keyboard.press('Control+A'); await p.keyboard.press('Delete'); await p.waitForTimeout(200)
    for (let i = 0; i < BODY.length; i++) { await p.keyboard.insertText(BODY[i]); if (i < BODY.length - 1) await p.keyboard.press('Enter') }
    await p.waitForTimeout(400)
    await p.getByRole('button', { name: 'Save' }).click({ timeout: 8000 })
    await p.waitForTimeout(2500); log('filled lesson + saved')
    await p.screenshot({ path: '/opt/synapse/course/claude_fixed.png' })
  } catch (e) { log('fill err', e.message.split('\n')[0]) }
  log('DONE')
  await b.close()
})().catch(e => log('ERR', e.message))
