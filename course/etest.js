const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs=require('fs'); const LOG='/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/etest.log'
const log=(...a)=>fs.appendFileSync(LOG,a.join(' ')+'\n'); fs.writeFileSync(LOG,'etest\n')
;(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9224',{timeout:15000});const ctx=b.contexts()[0];const p=await ctx.newPage()
await p.setViewportSize({width:1440,height:900})
await p.goto('https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9',{waitUntil:'domcontentloaded',timeout:30000}).catch(e=>log('nav',e.message))
await p.waitForTimeout(4000)
// click pencil to edit the currently shown page
await p.mouse.click(1204,197); await p.waitForTimeout(2000)
const s1=await p.evaluate(()=>({title:!!document.querySelector('input[placeholder="Title"]'),tiptap:!!document.querySelector('.tiptap.ProseMirror'),btns:[...document.querySelectorAll('button')].map(x=>({t:x.textContent.trim(),dis:x.disabled})).filter(x=>x.t)}))
log('editor open:',JSON.stringify(s1))
await p.screenshot({path:'/opt/synapse/course/etest_editor.png'})
try{
  await p.getByPlaceholder('Title').fill('TEST LESSON TITLE',{timeout:6000}); log('title filled')
  await p.locator('.tiptap.ProseMirror').first().click(); await p.waitForTimeout(300)
  await p.keyboard.insertText('First paragraph of the test.'); await p.keyboard.press('Enter'); await p.keyboard.insertText('Second paragraph.'); log('typed')
  await p.waitForTimeout(500)
  const s2=await p.evaluate(()=>[...document.querySelectorAll('button')].map(x=>({t:x.textContent.trim(),dis:x.disabled})).filter(x=>/save/i.test(x.t)))
  log('save buttons:',JSON.stringify(s2))
  await p.screenshot({path:'/opt/synapse/course/etest_filled.png'})
}catch(e){log('fill err',e.message.split('\n')[0])}
log('DONE');await b.close()})().catch(e=>log('ERR',e.message))
