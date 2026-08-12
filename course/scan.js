const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/scan.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'scan\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1000})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4500)
const links=await p.evaluate(()=>{const out=[];document.querySelectorAll('a[href*="/classroom/"]').forEach(a=>{const t=a.textContent.trim().split('\n')[0].slice(0,34);out.push({href:a.href,t})});return out})
const uniq=[...new Map(links.map(l=>[l.href,l])).values()]
log('courses found:',uniq.length)
for(const c of uniq){
  await p.goto(c.href,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{})
  await p.waitForTimeout(2500)
  const counts=await p.evaluate(()=>{
    const all=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim())
    const pages=all.filter(e=>{const t=e.textContent.trim();return t.length<70&&(/^[0-9]/.test(t)||t==='New page'||/lesson|intro|welcome/i.test(t))}).length
    // count sidebar rows roughly: items in the left nav
    return {bodyHasNewPageOnly: document.body.innerText.split('New page').length-1}
  })
  log(c.t,'=>','newpages~',counts.bodyHasNewPageOnly)
}
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
