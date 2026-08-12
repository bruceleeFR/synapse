const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/scan2.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'scan2\n')
const TITLES=['Welcome to the Future','CLAUDE CODE: YOUR FIRST SUPERPOWER','Your Builder Identity','Build Your AI Team','The Automation Engine','Give Your AI a Memory','Own Your Machine','Jarvis Online','The Stark Protocol','OpenClaw vs Hermes']
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1000})
for(const title of TITLES){
  await p.goto('https://www.skool.com/house-of-lamarca-/classroom',{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{})
  await p.waitForTimeout(3500)
  const ok=await p.evaluate((tt)=>{const t=[...document.querySelectorAll('*')].find(e=>e.children.length===0&&e.textContent.trim().startsWith(tt.slice(0,18)));if(!t)return false;let el=t;for(let i=0;i<6&&el;i++){const r=el.getBoundingClientRect();if(r.width>300&&r.height>200){el.click();return true}el=el.parentElement}t.click();return true},title)
  await p.waitForTimeout(3000)
  // count sidebar folders (chevron rows) and lessons/pages
  const c=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim()&&e.textContent.trim().length<70)
    const txt=document.body.innerText
    // heuristic: lessons often start with number or are page titles; count distinct short rows in left column (x<520)
    const left=[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return e.children.length===0&&r.x<520&&r.x>150&&e.textContent.trim()&&e.textContent.trim().length<70}).map(e=>e.textContent.trim())
    const uniq=[...new Set(left)]
    return {leftItems:uniq.length, sample:uniq.slice(2,10)}
  })
  log(title,'| url',p.url().split('?')[0].split('/').pop(),'| leftItems',c.leftItems,'| sample',JSON.stringify(c.sample))
}
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
