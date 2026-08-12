const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/verify.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'verify\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1000})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4000)
for(const f of ['Start Here','Explore Your Brain','Meet JARVIS','It Adapts To You','Make It Yours']){
  const y=await p.evaluate((f)=>{const t=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim()===f);if(!t)return null;const r=t.getBoundingClientRect();return r.y+r.height/2},f)
  if(y){await p.mouse.click(481,y);await p.waitForTimeout(700)}
}
await p.waitForTimeout(800)
const items=await p.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim()&&e.textContent.trim().length<60&&(/^[0-9]\.[0-9]/.test(e.textContent.trim())||e.textContent.trim()==='New page')).map(e=>e.textContent.trim()))
log('lessons+strays:',JSON.stringify(items))
log('New page count:',items.filter(t=>t==='New page').length,'| lessons:',items.filter(t=>/^[0-9]\.[0-9]/.test(t)).length)
await p.screenshot({path:'/opt/synapse/course/verify.png',fullPage:true})
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
