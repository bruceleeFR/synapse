const { chromium } = require('/opt/lamarca-web-studio/node_modules/playwright')
const fs = require('fs')
const LOG = '/tmp/claude-0/-root--openclaw-workspace/6b327273-6640-43e8-9cd2-01cc39ea3000/scratchpad/publish.log'
const log = (...a) => fs.appendFileSync(LOG, a.join(' ') + '\n')
fs.writeFileSync(LOG, 'publish ' + new Date().toISOString() + '\n')
const COURSE = 'https://www.skool.com/house-of-lamarca-/classroom/3f8ae1e9'

const DATA = [
  { folder: 'Start Here', lessons: [
    { t: '1.1 Your notes are dead. Let us fix that.', b: ['A folder of notes is a graveyard. A brain is alive. You have hundreds of notes and you never reread them. The problem is not you, it is the shape. A list hides how ideas connect.', 'SYNAPSE reads your notes and draws the web behind them. Every note becomes a node, every link a synapse. You see the shape of what you know, and the holes in it.', 'BUILD: open your notes folder and count the notes you have not opened in a month. That number is the point of this course.'] },
    { t: '1.2 Install in two minutes', b: ['No Python, no setup. Grab the file for your OS and double click. Your browser opens on a demo brain.', 'Download: https://github.com/bruceleeFR/synapse/releases/tag/v1.0.0', 'Windows: run SYNAPSE.exe, if SmartScreen warns click More info then Run anyway. Mac: unzip, then right click SYNAPSE.app and choose Open.', 'BUILD: install it and fly through the demo brain. Drag to move, scroll to zoom, click a node to read it.'] },
    { t: '1.3 Point it at your own notes', b: ['SYNAPSE reads plain markdown. An Obsidian vault works as is, because it is already markdown with wikilinks.', 'Run the app with a folder path to read your notes instead of the demo, for example SYNAPSE.exe with the path to your notes folder.', 'Two things power the graph: wikilinks like double bracket Another Note draw links, and folders and tags colour and group your brain.', 'BUILD: point SYNAPSE at your real notes and find your biggest hub, the note everything connects to.'] },
  ] },
  { folder: 'Explore Your Brain', lessons: [
    { t: '2.1 Read the 2D graph', b: ['The 2D view is your brain from above. A node is a note. Its size grows with how many links it has and how much you open it. The bright big ones are your hubs.', 'Hover a node to light up its neighbours. Click to read it with its links out and backlinks. Drag to pull it around and the brain settles back like elastic.', 'BUILD: find your three biggest hubs. Those are the pillars of how you think.'] },
    { t: '2.2 Fly the 3D brain', b: ['Hit 3D in the rail. Your notes become a galaxy with real bloom and synapses firing between the balls. Related notes cluster into clear lobes by theme.', 'Every ball shows its name so you read the brain without clicking. Click a ball to open the full note.', 'BUILD: orbit your brain in 3D and name each lobe out loud. Each cluster is a part of your life or business.'] },
    { t: '2.3 Search, filter, follow', b: ['The search bar filters your brain live as you type. Folder chips hide or show whole areas.', 'In a note panel, links out and backlinks are clickable, so you walk your ideas from note to note. Press Cmd or Ctrl and K for the command palette to jump to any note or run any action.', 'BUILD: open the palette, jump to an old note, then follow its backlinks and see where that idea traveled.'] },
  ] },
  { folder: 'Meet JARVIS', lessons: [
    { t: '3.1 Turn JARVIS on', b: ['The graph and every effect work with no key. To let JARVIS answer, open Tune JARVIS in the rail and paste an OpenAI key. Add an OpenRouter key too for Grok, Gemini and others.', 'Your key is saved locally in your vault config and never leaves your machine. Only the notes relevant to your question are sent, and only when you ask.', 'BUILD: paste your key in Tune JARVIS and watch the status turn to Brain connected.'] },
    { t: '3.2 Ask your own brain anything', b: ['Not the internet, your notes, answered in your words. Ask a real question about your work. JARVIS pulls the notes that matter, answers from them, flies the graph to the source, lights it up and reads it back.', 'Every answer shows the source notes so you can trust it.', 'BUILD: ask JARVIS one question you would normally dig through folders to answer, and watch it fly to the source.'] },
    { t: '3.3 Call JARVIS, live', b: ['Hit Call JARVIS. A full screen call opens with a glowing orb that reacts to your real voice. You talk, it thinks, it answers out loud, and it goes back to listening on its own.', 'You can drive the whole app by voice too: go 3D, fit the view, brain gaps, brief me, or switch model.', 'BUILD: start a call and ask something while your hands are busy.'] },
    { t: '3.4 Brain Gaps, the links you are missing', b: ['Hit Brain Gaps. SYNAPSE finds notes that clearly belong together but were never linked, draws them as dashed synapses, and tells you why.', 'Each suggestion has a plus link button. One tap writes the link into your notes for real. Your brain tidies itself.', 'BUILD: run Brain Gaps and apply the strongest suggestion. Watch a new synapse become permanent.'] },
  ] },
  { folder: 'It Adapts To You', lessons: [
    { t: '4.1 Quick Capture, a thought filed for you', b: ['Hit Quick Capture or the mic and say or type a raw idea. JARVIS reads your existing folders and notes, writes a clean note in the right place, tags it, and links it to what it relates to.', 'Zero filing, zero friction.', 'BUILD: capture a real idea you have right now and watch a new node appear, already linked into your brain.'] },
    { t: '4.2 Today’s Focus, your day from your brain', b: ['Hit Today’s Focus. JARVIS reads your open tasks, your recent notes, the notes that have gone cold, and a missing link, then hands you a short concrete plan for the day, out loud.', 'BUILD: add a couple of task lines to a note using dash space bracket space bracket, then hit Today’s Focus and get your plan.'] },
    { t: '4.3 The tour and the stats', b: ['Take the tour from the welcome screen or the palette. JARVIS flies you through your brain and narrates it: your busiest hub, your newest thought, your floating notes, a gap. Nobody gets the same tour.', 'Open Brain Stats for the numbers: notes, links, words, growth over time, your busiest areas and top hubs.', 'BUILD: take the tour, then open Brain Stats and screenshot your growth curve.'] },
    { t: '4.4 Auto tidy, Rediscover, living nodes', b: ['Apply all missing links tidies every gap at once. Rediscover surfaces an old note that ties into what you are doing now, so your brain reminds you of what you forgot.', 'Every note you open glows a little brighter and grows, so over time your graph shows your real priorities.', 'BUILD: run Rediscover and meet a note you forgot but still matters.'] },
  ] },
  { folder: 'Make It Yours', lessons: [
    { t: '5.1 White label SYNAPSE', b: ['Drop a config file in your notes folder with a name and two accent colours and SYNAPSE becomes yours. The brand mark, the accents and the whole look follow.', 'To a client it looks like software you built.', 'BUILD: rename it to your brand, pick two colours, reload. It is your product now.'] },
    { t: '5.2 Package it as an offer', b: ['A second brain is not a feature, it is an outcome people pay for. Sell it done for you, as a monthly retainer that keeps their brain tidy and answering, as a bundle with your coaching, or as a branded lead magnet.', 'Price the outcome, not the tool. People pay to stop losing what they know.', 'BUILD: write one sentence offer. I build a private second brain that answers your own knowledge, for X. Fill in the X.'] },
    { t: '5.3 The pitch that sells a second brain', b: ['Name the pain: you write things down and never find them again. Agitate: every lost note is a lost decision and a client you had to ask twice. Show the brain: open their notes as a living graph and let JARVIS answer a real question in front of them. Close: this is your knowledge, working for you, private, forever.', 'Do the demo live. The moment their own notes light up and answer them, the sale is mostly done.', 'BUILD: record a two minute demo on your own brain and post it. That video is your best salesperson.'] },
  ] },
]

async function typeBody(p, paras) {
  const ed = p.locator('.tiptap.ProseMirror').first()
  await ed.click({ timeout: 6000 })
  await p.waitForTimeout(200)
  for (let i = 0; i < paras.length; i++) {
    await p.keyboard.insertText(paras[i])
    if (i < paras.length - 1) await p.keyboard.press('Enter')
  }
}

async function folderMenu(p, folder) {
  const y = await p.evaluate((f) => { const t = [...document.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === f); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return r.y + r.height / 2 }, folder)
  await p.mouse.move(336, y); await p.waitForTimeout(500)
  await p.mouse.click(440, y); await p.waitForTimeout(900)
  await p.getByText('Add page in folder', { exact: true }).click({ timeout: 6000 })
  await p.waitForTimeout(2000)
}

;(async () => {
  const b = await chromium.connectOverCDP('http://127.0.0.1:9224', { timeout: 15000 })
  const ctx = b.contexts()[0]
  const p = await ctx.newPage()
  await p.setViewportSize({ width: 1440, height: 900 })
  await p.goto(COURSE, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => log('nav', e.message))
  await p.waitForTimeout(4000); log('course loaded')
  let n = 0
  for (const mod of DATA) {
    for (const les of mod.lessons) {
      n++
      try {
        await folderMenu(p, mod.folder)                      // add page in folder -> new page selected
        // open the editor (pencil top-right of right panel)
        await p.mouse.click(1204, 197); await p.waitForTimeout(1500)
        await p.getByPlaceholder('Title').fill(les.t, { timeout: 6000 })
        await typeBody(p, les.b)
        await p.waitForTimeout(400)
        const sv = p.getByRole('button', { name: 'Save' })   // matches SAVE (case-insensitive without exact)
        await sv.click({ timeout: 8000 })
        await p.waitForTimeout(2200)
        log('OK', n, mod.folder, '=>', les.t.slice(0, 40))
      } catch (e) {
        log('FAIL', n, mod.folder, les.t.slice(0, 30), e.message.split('\n')[0])
        // try to recover: press Escape to close any stuck dialog
        await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(800)
      }
    }
  }
  await p.screenshot({ path: '/opt/synapse/course/published.png' })
  log('DONE total', n)
  await b.close()
})().catch(e => log('ERR', e.message))
