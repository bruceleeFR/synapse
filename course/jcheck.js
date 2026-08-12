const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/jcheck.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'jcheck\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:1300})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom/1cba1fd1',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4000)
// expand all chevrons
const chevs=await p.evaluate(()=>{const o=[];document.querySelectorAll('svg').forEach(s=>{const r=s.getBoundingClientRect();if(r.x>466&&r.x<494&&r.y>205&&r.y<1250&&r.width<28)o.push(Math.round(r.y+r.height/2))});return [...new Set(o)]})
for(const y of chevs.reverse()){await p.mouse.click(481,y);await p.waitForTimeout(450)}
await p.waitForTimeout(700)
const rows=await p.evaluate(()=>[...document.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return e.children.length===0&&r.x>175&&r.x<520&&r.y>205&&r.y<1260&&e.textContent.trim()&&e.textContent.trim().length<70}).map(e=>{const r=e.getBoundingClientRect();return e.textContent.trim()+' @x'+Math.round(r.x)+' y'+Math.round(r.y)}))
log('SIDEBAR:\n'+[...new Set(rows)].join('\n'))
await p.screenshot({path:'/opt/synapse/course/jarvis_online.png'})
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
