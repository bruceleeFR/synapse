const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/ctop.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'ctop\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1400})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom/7ae572c5',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4500)
const rows=[238,286,334,382,430,478]
for(const y of rows){
  await p.mouse.click(300,y);await p.waitForTimeout(1300)
  const info=await p.evaluate(()=>{
    // title = h1/h2 near top of right panel; content = big card innerText
    let title='';const hs=[...document.querySelectorAll('h1,h2,h3')].filter(h=>{const r=h.getBoundingClientRect();return r.x>540});if(hs[0])title=hs[0].innerText.trim()
    const cards=[...document.querySelectorAll('div')].filter(d=>{const r=d.getBoundingClientRect();return r.x>540&&r.width>500&&r.height>60});let best='';for(const c of cards){if(c.innerText.length>best.length)best=c.innerText}
    return {title,len:best.length}
  })
  log('ROW y'+y,'| title',JSON.stringify(info.title.slice(0,40)),'| contentChars',info.len)
}
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
