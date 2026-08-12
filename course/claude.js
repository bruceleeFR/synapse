const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/claude.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'claude\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1400})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom/7ae572c5',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4000)
// expand all folders: click every sidebar row that contains a chevron svg, bottom-up a few passes
for(let pass=0;pass<3;pass++){
  const folders=await p.evaluate(()=>{
    const out=[]
    document.querySelectorAll('svg').forEach(s=>{const r=s.getBoundingClientRect();if(r.x>440&&r.x<500&&r.y>200&&r.y<1350){out.push(r.y+r.height/2)}})
    return [...new Set(out.map(y=>Math.round(y)))]
  })
  for(const y of folders.reverse()){await p.mouse.click(481,y);await p.waitForTimeout(500)}
  await p.waitForTimeout(600)
}
// collect lesson rows (indented, no chevron) and check each
const lessons=await p.evaluate(()=>{
  const rows=[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return e.children.length===0&&r.x>190&&r.x<520&&r.y>200&&e.textContent.trim()&&e.textContent.trim().length<70})
  const seen=new Set();const out=[]
  for(const e of rows){const t=e.textContent.trim();if(seen.has(t))continue;seen.add(t);const r=e.getBoundingClientRect();out.push({t,y:Math.round(r.y+r.height/2),x:Math.round(r.x)})}
  return out
})
log('sidebar rows:',lessons.length)
for(const l of lessons){
  if(/^(Classroom|Calendar|Members|Map|Leaderboards|About|Community|Learn|Build|Ship|From Zero|0[0-9] |[0-9]+%)/.test(l.t))continue
  await p.mouse.click(l.x+20,l.y);await p.waitForTimeout(1200)
  const clen=await p.evaluate(()=>{const main=document.querySelector('main')||document.body;const t=main.innerText||'';return t.length})
  const body=await p.evaluate(()=>{
    // the lesson content is in the right panel; grab visible paragraph text length excluding title
    const cards=[...document.querySelectorAll('div')].filter(d=>{const r=d.getBoundingClientRect();return r.x>540&&r.width>400&&r.height>80})
    let best='';for(const c of cards){if(c.innerText.length>best.length)best=c.innerText}
    return best.length
  })
  log('LESSON', JSON.stringify(l.t), '=> contentChars', body)
}
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
