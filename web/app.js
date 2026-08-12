/* SYNAPSE 2D brain — force-directed graph on canvas. No dependencies. */
(async () => {
  const $ = s => document.querySelector(s)
  const cv = $('#g'), ctx = cv.getContext('2d')
  const fx = $('#fx'), fxc = fx.getContext('2d')
  const mini = $('#mini'), mc = mini.getContext('2d')
  let W, H, DPR = Math.min(2, window.devicePixelRatio || 1)
  function resize() {
    W = innerWidth; H = innerHeight
    for (const c of [cv, fx]) { c.width = W * DPR; c.height = H * DPR; c.style.width = W + 'px'; c.style.height = H + 'px'; c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0) }
    mini.width = 180 * DPR; mini.height = 120 * DPR; mc.setTransform(DPR, 0, 0, DPR, 0, 0)
  }
  window.addEventListener('resize', resize); resize()

  const cfg = await (await fetch('/config.json')).json()
  const A = cfg.accent || '#5b8bff', A2 = cfg.accent2 || '#8f6bff'
  document.documentElement.style.setProperty('--a', A)
  document.documentElement.style.setProperty('--a2', A2)
  if (cfg.name) { $('#brandName').textContent = cfg.name; document.title = cfg.name + ' · second brain' }
  let usage = {}; try { usage = JSON.parse(localStorage.getItem('synapse_usage') || '{}') } catch (e) { }
  const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)
  // ---- i18n (shared, see i18n.js)
  const T = window.SYN_T, applyLang = window.SYN_applyLang, setLang = window.SYN_setLang, LINKEDIN = window.SYN_LINKEDIN
  function bumpUsage(id) { usage[id] = (usage[id] || 0) + 1; try { localStorage.setItem('synapse_usage', JSON.stringify(usage)) } catch (e) { } }

  let G = await (await fetch('/graph.json')).json()
  let vaultInfo = { vaults: [] }; try { vaultInfo = await (await fetch('/api/vaults')).json() } catch (e) { }
  const PALETTE = ['#5b8bff', '#8f6bff', '#38d996', '#ffb454', '#ff6b9d', '#3fd0e0', '#c78bff', '#ffd166']
  let folders = [], colorOf = {}
  const nodes = new Map(), links = []

  function build() {
    folders = G.meta.folders.slice()
    folders.forEach((f, i) => colorOf[f] = PALETTE[i % PALETTE.length])
    nodes.clear(); links.length = 0
    const R = Math.min(W, H) * 0.34
    for (const n of G.nodes) {
      const prev = nodes.get(n.id)
      nodes.set(n.id, Object.assign({
        x: prev ? prev.x : W / 2 + (Math.random() - .5) * R * 2,
        y: prev ? prev.y : H / 2 + (Math.random() - .5) * R * 2,
        vx: 0, vy: 0
      }, n))
    }
    for (const e of G.edges) { const s = nodes.get(e.source), t = nodes.get(e.target); if (s && t) links.push({ s, t }) }
    buildFilters(); buildAdj()
  }
  let adj = new Map()
  function buildAdj() { adj = new Map(); for (const n of nodes.keys()) adj.set(n, new Set()); for (const l of links) { adj.get(l.s.id).add(l.t.id); adj.get(l.t.id).add(l.s.id) } }

  // clustering by theme: colour by dominant tag instead of folder
  let clusterMode = false
  const tagColorMap = {}
  function nodeColor(n) {
    if (!clusterMode) return colorOf[n.folder] || A
    const k = (n.tags && n.tags[0]) || n.folder
    if (!tagColorMap[k]) tagColorMap[k] = PALETTE[Object.keys(tagColorMap).length % PALETTE.length]
    return tagColorMap[k]
  }

  // ---- camera
  let cam = { x: W / 2, y: H / 2, z: 1 }
  function toScreen(p) { return { x: (p.x - cam.x) * cam.z + W / 2, y: (p.y - cam.y) * cam.z + H / 2 } }
  function toWorld(sx, sy) { return { x: (sx - W / 2) / cam.z + cam.x, y: (sy - H / 2) / cam.z + cam.y } }

  // ---- force sim
  let alpha = 1
  function radius(n) { return 5 + Math.sqrt((n.deg || 0)) * 3.2 + Math.min(6, (n.words || 0) / 250) + Math.min(7, (usage[n.id] || 0) * 1.3) }
  function tick() {
    if (alpha > .01) alpha *= 0.985
    const arr = [...nodes.values()], REP = 5200 * (0.4 + alpha)
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i]
      for (let j = i + 1; j < arr.length; j++) {
        const b = arr[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy || 1
        if (d2 > 360000) continue
        const f = REP / d2, d = Math.sqrt(d2); dx /= d; dy /= d
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f
      }
      a.vx += (W / 2 - a.x) * 0.0022 * alpha
      a.vy += (H / 2 - a.y) * 0.0022 * alpha
    }
    for (const l of links) {
      let dx = l.t.x - l.s.x, dy = l.t.y - l.s.y, d = Math.hypot(dx, dy) || 1
      const target = 90 + radius(l.s) + radius(l.t), f = (d - target) * 0.02
      dx /= d; dy /= d
      l.s.vx += dx * f; l.s.vy += dy * f; l.t.vx -= dx * f; l.t.vy -= dy * f
    }
    for (const n of nodes.values()) {
      if (n === drag) continue
      n.vx *= 0.82; n.vy *= 0.82
      n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy))
    }
  }

  // ---- state
  let hover = null, sel = null, drag = null, hidden = new Set(), matchSet = null
  const pulses = new Map()   // nodeId -> start ms (expanding ring)
  let fires = []             // {a,b,t0} traveling signal along an edge
  let ghosts = []            // Brain Gaps: {s,t,why,a,b} dashed suggested links
  let lastStorm = 0          // ambient neural storm timer
  let focusSet = null        // Focus mode: only these ids stay lit
  let pickMode = null        // 'focus' | 'path' — waiting for node clicks
  let pathPick = []          // collected ids while picking a path
  let pathEdges = null       // illuminated route between two notes
  let trail = []             // fading trail behind a dragged node
  const nowms = () => performance.now()

  function neighborsHi() {
    const focus = hover || sel
    if (!focus) return null
    const s = new Set([focus.id]); for (const id of adj.get(focus.id) || []) s.add(id); return s
  }

  // ---- render
  function draw() {
    tick()
    // ambient neural storm: a faint synapse fires now and then, so the brain feels alive
    const tstorm = nowms()
    if (!REDUCED && tstorm - lastStorm > 2400 && links.length) { lastStorm = tstorm; const l = links[(Math.random() * links.length) | 0]; fires.push({ a: l.s, b: l.t, t0: tstorm, amb: true }) }
    ctx.clearRect(0, 0, W, H)
    const hi = neighborsHi()
    // edges: gradient beams with energy flowing along them (flow off for reduced-motion or huge graphs)
    const flow = (nowms() / 1400) % 1, flowOn = !REDUCED && links.length < 500
    for (const l of links) {
      if (hidden.has(l.s.folder) || hidden.has(l.t.folder)) continue
      if (focusSet && !(focusSet.has(l.s.id) && focusSet.has(l.t.id))) continue
      const on = hi && hi.has(l.s.id) && hi.has(l.t.id), dimEdge = hi && !on
      const a = toScreen(l.s), b = toScreen(l.t)
      if (on) {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y)
        g.addColorStop(0, nodeColor(l.s)); g.addColorStop(1, nodeColor(l.t))
        ctx.strokeStyle = g; ctx.lineWidth = 1.9
      } else { ctx.strokeStyle = dimEdge ? 'rgba(120,150,200,.05)' : 'rgba(130,160,210,.13)'; ctx.lineWidth = 1 }
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      if (!dimEdge && flowOn) {
        const fx1 = a.x + (b.x - a.x) * flow, fy1 = a.y + (b.y - a.y) * flow
        ctx.fillStyle = on ? '#cfe0ff' : 'rgba(150,180,255,.28)'
        ctx.beginPath(); ctx.arc(fx1, fy1, on ? 2.1 : 1.3, 0, 7); ctx.fill()
      }
    }
    drawGhosts()
    // nodes
    for (const n of nodes.values()) {
      if (hidden.has(n.folder)) continue
      const s = toScreen(n), r = radius(n) * cam.z
      const dim = (hi && !hi.has(n.id)) || (matchSet && !matchSet.has(n.id))
      const col = nodeColor(n)
      ctx.globalAlpha = dim ? 0.18 : 1
      // glow
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 2.6)
      g.addColorStop(0, col + 'cc'); g.addColorStop(1, col + '00')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r * 2.6, 0, 7); ctx.fill()
      // holographic scan rings on hubs (living node look)
      if (!dim && ((n.deg || 0) >= 3 || n === sel)) {
        const tt = nowms() / 1000, base = r + 6
        for (let i = 0; i < 2; i++) {
          const rr = base + i * 6 + Math.sin(tt * 1.4 + i) * 2
          ctx.beginPath(); ctx.arc(s.x, s.y, rr, (tt * (i ? -1 : 1)) % 6.28, (tt * (i ? -1 : 1)) % 6.28 + 4.2)
          ctx.strokeStyle = col + '77'; ctx.lineWidth = 1.4; ctx.stroke()
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, base + 12, 0, 7); ctx.strokeStyle = col + '22'; ctx.lineWidth = 1; ctx.stroke()
      }
      // core
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fillStyle = col; ctx.fill()
      ctx.lineWidth = (n === sel) ? 2.5 : 1; ctx.strokeStyle = (n === sel) ? '#fff' : 'rgba(255,255,255,.3)'; ctx.stroke()
      // glossy specular highlight (glass sphere look)
      const hl = ctx.createRadialGradient(s.x - r * .34, s.y - r * .4, 0, s.x - r * .34, s.y - r * .4, r * 1.15)
      hl.addColorStop(0, 'rgba(255,255,255,.55)'); hl.addColorStop(.42, 'rgba(255,255,255,.07)'); hl.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hl; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill()
      // label
      if (!dim && (cam.z > 1.15 || r > 9 || n === hover || n === sel)) {
        ctx.globalAlpha = dim ? 0.2 : 1
        ctx.fillStyle = '#e7eefc'; ctx.font = `${Math.max(11, 12 * Math.min(1.4, cam.z))}px DejaVu Sans, sans-serif`
        ctx.textAlign = 'center'; ctx.fillText(n.title, s.x, s.y + r + 14)
      }
    }
    ctx.globalAlpha = 1
    drawPath()
    // fading drag trail
    if (trail.length) {
      const tt = nowms(); trail = trail.filter(p => tt - p.t < 600)
      for (const p of trail) { const k = 1 - (tt - p.t) / 600; ctx.fillStyle = A + Math.round(k * 170).toString(16).padStart(2, '0'); ctx.beginPath(); ctx.arc(p.x, p.y, 3 * k + 1, 0, 7); ctx.fill() }
    }
    drawSignals()
    drawMini()
    requestAnimationFrame(draw)
  }
  function drawPath() {
    if (!pathEdges) return
    const t = nowms(), fl = (t / 700) % 1
    for (const e of pathEdges) {
      const a = toScreen(e.s), b = toScreen(e.t)
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y); g.addColorStop(0, A); g.addColorStop(1, A2)
      ctx.strokeStyle = g; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      const px = a.x + (b.x - a.x) * fl, py = a.y + (b.y - a.y) * fl
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill()
    }
  }

  function drawSignals() {
    const t = nowms()
    // firing signals travelling along edges
    fires = fires.filter(f => t - f.t0 < 1400)
    for (const f of fires) {
      const k = ((t - f.t0) % 700) / 700
      const a = toScreen(f.a), b = toScreen(f.b)
      const px = a.x + (b.x - a.x) * k, py = a.y + (b.y - a.y) * k
      const amb = f.amb, sz = amb ? 6 : 9
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.strokeStyle = A + (amb ? '2a' : '66'); ctx.lineWidth = amb ? 1 : 1.6; ctx.stroke()
      const g = ctx.createRadialGradient(px, py, 0, px, py, sz); g.addColorStop(0, amb ? A + 'cc' : '#fff'); g.addColorStop(1, A + '00')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, sz, 0, 7); ctx.fill()
    }
    // pulse rings on focused nodes
    for (const [id, t0] of [...pulses]) {
      const age = t - t0; if (age > 1600) { pulses.delete(id); continue }
      const n = nodes.get(id); if (!n) continue
      const s = toScreen(n); const r = radius(n) * cam.z
      for (let i = 0; i < 2; i++) {
        const p = ((age + i * 500) % 1500) / 1500
        ctx.beginPath(); ctx.arc(s.x, s.y, r + p * 46, 0, 7)
        ctx.strokeStyle = (colorOf[n.folder] || A) + Math.round((1 - p) * 200).toString(16).padStart(2, '0')
        ctx.lineWidth = 2; ctx.stroke()
      }
    }
    // JARVIS speaking: throb the node in focus
    if (speaking && sel) {
      const s = toScreen(sel), r = radius(sel) * cam.z, p = (Math.sin(t / 130) + 1) / 2
      ctx.beginPath(); ctx.arc(s.x, s.y, r + 7 + p * 11, 0, 7)
      ctx.strokeStyle = A2 + Math.round(110 + p * 110).toString(16).padStart(2, '0'); ctx.lineWidth = 2.5; ctx.stroke()
    }
  }

  // Brain Gaps: dashed animated "missing synapse" edges
  function drawGhosts() {
    if (!ghosts.length) return
    const t = nowms()
    ctx.save(); ctx.setLineDash([6, 7]); ctx.lineDashOffset = -(t / 40) % 13; ctx.lineWidth = 1.6
    for (const g of ghosts) {
      if (hidden.has(g.s.folder) || hidden.has(g.t.folder)) continue
      const a = toScreen(g.s), b = toScreen(g.t)
      ctx.strokeStyle = A2 + 'bb'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      for (const p of [a, b]) { const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11); gr.addColorStop(0, A2 + 'cc'); gr.addColorStop(1, A2 + '00'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.fill() }
    }
    ctx.restore()
  }

  async function discover() {
    const btn = $('#navgaps')
    if (ghosts.length) { ghosts = []; btn.classList.remove('live'); return }   // toggle off
    btn.classList.add('live')
    const r = await (await fetch('/api/suggest')).json()
    ghosts = (r.pairs || []).map(p => ({ s: nodes.get(p.source), t: nodes.get(p.target), why: p.why, a: p.a, b: p.b })).filter(g => g.s && g.t)
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    const wrap = document.createElement('div'); wrap.className = 'msg a'
    if (!ghosts.length) { wrap.innerHTML = '<b>'+T('gaps')+'</b><br>Your brain is well connected. No obvious missing links right now.'; log.appendChild(wrap); btn.classList.remove('live'); return }
    wrap.innerHTML = `<b>Brain Gaps</b><br>I found ${ghosts.length} connection${ghosts.length > 1 ? 's' : ''} your brain is missing. Tap one to fly there.`
    const list = document.createElement('div'); list.className = 'gaps'
    ghosts.forEach(g => {
      const row = document.createElement('div'); row.className = 'gap'
      const main = document.createElement('div'); main.className = 'gapmain'; main.innerHTML = `<span>${g.a} ↔ ${g.b}</span><small>${g.why}</small>`
      main.onclick = () => flyFire([g.s.id, g.t.id])
      const add = document.createElement('button'); add.className = 'gapadd'; add.textContent = '+ link'
      add.onclick = async (ev) => { ev.stopPropagation(); add.textContent = '…'; await applyLink(g); add.textContent = 'linked ✓'; add.classList.add('done') }
      row.appendChild(main); row.appendChild(add); list.appendChild(row)
    })
    wrap.appendChild(list); log.appendChild(wrap); log.scrollTop = log.scrollHeight
    flyFire(ghosts.slice(0, 3).flatMap(g => [g.s.id, g.t.id]))
    speak(`I found ${ghosts.length} connections your brain is missing. The strongest is ${ghosts[0].a} and ${ghosts[0].b}.`)
  }

  async function runBriefing() {
    const r = await (await fetch('/api/briefing')).json()
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    const el = document.createElement('div'); el.className = 'msg a'; el.innerHTML = '<b>'+T('l_brief')+'</b><br>' + (r.answer || '')
    log.appendChild(el); log.scrollTop = log.scrollHeight
    flyFire(r.focus); speak(r.spoken || r.answer)
  }

  // auto tidy: write a missing link into the notes
  async function applyLink(g) {
    const sid = g.s.id, tid = g.t.id
    const r = await (await fetch('/api/link', { method: 'POST', body: JSON.stringify({ source: sid, target: g.t.title }) })).json()
    if (r.ok) {
      G = await (await fetch('/graph.json')).json(); build(); stat()
      ghosts = ghosts.filter(x => !(x.s.id === sid && x.t.id === tid)).map(x => ({ ...x, s: nodes.get(x.s.id), t: nodes.get(x.t.id) })).filter(x => x.s && x.t)
      flyFire([sid, tid])
    }
  }
  async function applyAllLinks() {
    if (!ghosts.length) { await discover() }
    if (!ghosts.length) return
    const pairs = ghosts.map(g => ({ source: g.s.id, target: g.t.title }))
    for (const p of pairs) await fetch('/api/link', { method: 'POST', body: JSON.stringify(p) })
    G = await (await fetch('/graph.json')).json(); ghosts = []; $('#navgaps').classList.remove('live'); build(); stat()
  }
  // resurface an older note tied to recent work
  async function runRediscover() {
    const r = await (await fetch('/api/rediscover')).json()
    $('#jarvis').classList.add('open'); const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    const el = document.createElement('div'); el.className = 'msg a'; el.innerHTML = '<b>'+T('l_redis')+'</b><br>' + (r.answer || '')
    if (r.sources && r.sources[0]) { const s = document.createElement('div'); s.className = 'src'; const b = document.createElement('span'); b.textContent = r.sources[0].title; b.onclick = () => { const m = nodes.get(r.sources[0].id); if (m) { flyFire([m.id]); openNode(m) } }; s.appendChild(b); el.appendChild(s) }
    log.appendChild(el); log.scrollTop = log.scrollHeight; flyFire(r.focus); speak(r.spoken || r.answer)
  }

  // fly to the JARVIS source nodes and fire the synapses between them
  function flyFire(ids) {
    const ns = (ids || []).map(id => nodes.get(id)).filter(Boolean)
    if (!ns.length) return
    let cx = 0, cy = 0; ns.forEach(n => { cx += n.x; cy += n.y }); cx /= ns.length; cy /= ns.length
    animateCam(cx, cy, Math.max(1.1, Math.min(1.8, 2 - ns.length * 0.12)))
    const t = nowms(); ns.forEach(n => pulses.set(n.id, t))
    sel = ns[0]
    // fire edges among the focus set and out to their neighbours
    const set = new Set(ns.map(n => n.id))
    for (const l of links) {
      if (set.has(l.s.id) && set.has(l.t.id)) fires.push({ a: l.s, b: l.t, t0: t })
      else if (set.has(l.s.id)) fires.push({ a: l.s, b: l.t, t0: t + 120 })
      else if (set.has(l.t.id)) fires.push({ a: l.t, b: l.s, t0: t + 120 })
    }
  }
  let camAnim = null
  function animateCam(x, y, z) {
    const s = { x: cam.x, y: cam.y, z: cam.z }, t0 = nowms()
    camAnim = () => {
      const k = Math.min(1, (nowms() - t0) / 600), e = 1 - Math.pow(1 - k, 3)
      cam.x = s.x + (x - s.x) * e; cam.y = s.y + (y - s.y) * e; cam.z = s.z + (z - s.z) * e
      if (k < 1) requestAnimationFrame(camAnim); else camAnim = null
    }
    requestAnimationFrame(camAnim)
  }

  function drawMini() {
    mc.clearRect(0, 0, 180, 120)
    let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9
    for (const n of nodes.values()) { minx = Math.min(minx, n.x); miny = Math.min(miny, n.y); maxx = Math.max(maxx, n.x); maxy = Math.max(maxy, n.y) }
    const pad = 12, sx = (180 - pad * 2) / (maxx - minx || 1), sy = (120 - pad * 2) / (maxy - miny || 1), s = Math.min(sx, sy)
    const mx = x => pad + (x - minx) * s, my = y => pad + (y - miny) * s
    mc.strokeStyle = 'rgba(120,150,200,.12)'; mc.lineWidth = .5
    for (const l of links) { mc.beginPath(); mc.moveTo(mx(l.s.x), my(l.s.y)); mc.lineTo(mx(l.t.x), my(l.t.y)); mc.stroke() }
    for (const n of nodes.values()) { mc.fillStyle = colorOf[n.folder] || A; mc.beginPath(); mc.arc(mx(n.x), my(n.y), 1.6, 0, 7); mc.fill() }
    // viewport rect
    const tl = toWorld(0, 0), br = toWorld(W, H)
    mc.strokeStyle = 'rgba(255,255,255,.4)'; mc.lineWidth = 1
    mc.strokeRect(mx(tl.x), my(tl.y), (br.x - tl.x) * s, (br.y - tl.y) * s)
  }

  // ---- background particles
  const neb = [{ x: .3, y: .35, r: .5, c: '90,140,255' }, { x: .72, y: .3, r: .45, c: '150,110,255' }, { x: .55, y: .72, r: .55, c: '60,200,180' }, { x: .18, y: .78, r: .4, c: '255,120,160' }]
  const parts = Array.from({ length: 120 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + .3, v: Math.random() * .0004 + .0001, d: Math.random() * .7 + .2 }))
  function drawFx() {
    fxc.clearRect(0, 0, W, H)
    const t = nowms() / 1000
    // drifting nebula clouds for depth
    for (const n of neb) {
      const cx = (n.x + Math.sin(t * .05 + n.y * 9) * .02) * W, cy = (n.y + Math.cos(t * .04 + n.x * 7) * .02) * H, R = n.r * Math.min(W, H)
      const g = fxc.createRadialGradient(cx, cy, 0, cx, cy, R)
      g.addColorStop(0, `rgba(${n.c},.09)`); g.addColorStop(1, `rgba(${n.c},0)`)
      fxc.fillStyle = g; fxc.beginPath(); fxc.arc(cx, cy, R, 0, 7); fxc.fill()
    }
    // parallax starfield (drifts against the camera)
    const px = (cam.x - W / 2) * .02, py = (cam.y - H / 2) * .02
    for (const p of parts) {
      p.y -= p.v; if (p.y < 0) p.y = 1
      const x = ((p.x * W - px * p.d) % W + W) % W, y = ((p.y * H - py * p.d) % H + H) % H
      fxc.fillStyle = 'rgba(150,180,255,' + (.05 + p.s * .07) + ')'; fxc.beginPath(); fxc.arc(x, y, p.s, 0, 7); fxc.fill()
    }
    requestAnimationFrame(drawFx)
  }
  drawFx()

  // ---- picking
  function pick(sx, sy) {
    let best = null, bd = 1e9
    for (const n of nodes.values()) {
      if (hidden.has(n.folder)) continue
      const s = toScreen(n), r = radius(n) * cam.z + 6, d = Math.hypot(s.x - sx, s.y - sy)
      if (d < r && d < bd) { bd = d; best = n }
    }
    return best
  }
  cv.addEventListener('mousemove', e => {
    if (drag) { const w = toWorld(e.clientX, e.clientY); drag.x = w.x; drag.y = w.y; drag.vx = drag.vy = 0; alpha = Math.max(alpha, .3); trail.push({ x: e.clientX, y: e.clientY, t: nowms() }); return }
    if (pan) { cam.x -= (e.clientX - pan.x) / cam.z; cam.y -= (e.clientY - pan.y) / cam.z; pan = { x: e.clientX, y: e.clientY }; return }
    hover = pick(e.clientX, e.clientY); cv.style.cursor = hover ? 'pointer' : 'grab'
  })
  let pan = null
  cv.addEventListener('mousedown', e => { const n = pick(e.clientX, e.clientY); if (n) { drag = n; } else { pan = { x: e.clientX, y: e.clientY }; cv.classList.add('drag') } })
  window.addEventListener('mouseup', e => { if (drag && Math.hypot(0, 0) === 0) { } drag = null; pan = null; cv.classList.remove('drag') })
  cv.addEventListener('click', e => {
    const n = pick(e.clientX, e.clientY); if (!n) return
    if (pickMode === 'focus') { focusSet = new Set([n.id, ...(adj.get(n.id) || [])]); matchSet = focusSet; pickMode = null; hideHint(); flyFire([n.id]); return }
    if (pickMode === 'path') {
      pathPick.push(n.id)
      if (pathPick.length === 1) { showHint('Now click the destination note'); flyFire([n.id]) }
      else { const p = bfsPath(pathPick[0], pathPick[1]); pickMode = null; pathPick = []; hideHint()
        if (p) { pathEdges = []; for (let i = 0; i < p.length - 1; i++) pathEdges.push({ s: nodes.get(p[i]), t: nodes.get(p[i + 1]) }); flyFire(p) }
        else showHint('No path between those two. (click anywhere)') }
      return
    }
    openNode(n)
  })
  function bfsPath(a, b) {
    if (a === b) return [a]
    const prev = new Map([[a, null]]), q = [a]
    while (q.length) { const u = q.shift(); for (const v of adj.get(u) || []) { if (!prev.has(v)) { prev.set(v, u); if (v === b) { const p = []; let x = v; while (x != null) { p.unshift(x); x = prev.get(x) } return p } q.push(v) } } }
    return null
  }
  function showHint(t) { $('#phint').textContent = t; $('#phint').classList.add('show') }
  function hideHint() { $('#phint').classList.remove('show') }
  function startPath() { pickMode = 'path'; pathPick = []; showHint('Click the start note') }
  function startFocus() { pickMode = 'focus'; showHint('Click a note to focus on it') }
  function clearFocus() { focusSet = null; matchSet = null; pathEdges = null; pickMode = null; hideHint() }
  cv.addEventListener('wheel', e => {
    e.preventDefault(); const w = toWorld(e.clientX, e.clientY)
    cam.z = Math.max(.15, Math.min(6, cam.z * (e.deltaY < 0 ? 1.12 : .89)))
    const w2 = toWorld(e.clientX, e.clientY); cam.x += w.x - w2.x; cam.y += w.y - w2.y
  }, { passive: false })

  // ---- panel
  async function openNode(n) {
    sel = n; bumpUsage(n.id)
    try { history.replaceState(null, '', '#note=' + encodeURIComponent(n.id)) } catch (e) { }
    $('#pFold').textContent = n.folder
    $('#pTitle').textContent = n.title
    $('#pTags').innerHTML = (n.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')
    const out = [...(adj.get(n.id) || [])].map(id => nodes.get(id))
    const back = (n.backlinks || []).map(id => nodes.get(id)).filter(Boolean)
    const linkHtml = arr => arr.length ? arr.map(m => `<div class="lnk" data-id="${encodeURIComponent(m.id)}"><span class="a">→</span>${m.title}</div>`).join('') : `<div class="hint">${T('none')}</div>`
    let body = ''
    const r = await (await fetch('/note?id=' + encodeURIComponent(n.id))).json()
    const clean = (r.text || '').replace(/^---[\s\S]*?---\n/, '').trim().slice(0, 1400)
    body += `<pre>${clean.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</pre>`
    body += `<div class="lbl">${T('linksout')} (${out.length})</div>${linkHtml(out)}`
    body += `<div class="lbl">${T('backlinks')} (${back.length})</div>${linkHtml(back)}`
    $('#pBody').innerHTML = body
    $('#panel').classList.add('open')
    $('#pBody').querySelectorAll('.lnk').forEach(el => el.onclick = () => { const m = nodes.get(decodeURIComponent(el.dataset.id)); if (m) { focus(m); openNode(m) } })
  }
  window.closePanel = () => { $('#panel').classList.remove('open'); sel = null }
  function focus(n) { cam.x = n.x; cam.y = n.y; cam.z = Math.max(cam.z, 1.4) }

  // ---- filters
  function buildFilters() {
    $('#filters').innerHTML = folders.map(f => `<span class="chip on" data-f="${f}" style="--c:${colorOf[f]}"><span class="d" style="background:${colorOf[f]}"></span>${f}</span>`).join('')
    $('#filters').querySelectorAll('.chip').forEach(c => c.onclick = () => {
      const f = c.dataset.f
      if (hidden.has(f)) { hidden.delete(f); c.classList.add('on'); c.style.background = '' }
      else { hidden.add(f); c.classList.remove('on'); c.style.background = 'transparent' }
      c.classList.toggle('on'); c.style.borderColor = c.classList.contains('on') ? colorOf[f] : 'var(--line)'
    })
    $('#filters').querySelectorAll('.chip').forEach(c => c.style.borderColor = colorOf[c.dataset.f])
  }

  // ---- search
  $('#q').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase()
    if (!q) { matchSet = null; return }
    matchSet = new Set()
    for (const n of nodes.values()) if ((n.title + ' ' + n.excerpt + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q)) matchSet.add(n.id)
    const first = [...matchSet][0]; if (first) focus(nodes.get(first))
  })

  // ---- bar
  $('#fit').onclick = () => { cam.x = W / 2; cam.y = H / 2; cam.z = 0.7; }
  $('#rescan').onclick = async () => { await fetch('/rescan'); G = await (await fetch('/graph.json')).json(); build(); stat() }
  function stat() {
    $('#stat').textContent = `${G.meta.count} notes · ${G.meta.edges} links · ${G.meta.folders.length} areas`
    $('#hNotes').textContent = G.meta.count; $('#hLinks').textContent = G.meta.edges
  }

  // ---- jarvis + voice
  $('#jbtn').onclick = () => $('#jarvis').classList.toggle('open')
  let speaking = false, voicePref = null
  function pickVoice() {
    const vs = speechSynthesis.getVoices()
    if (voicePref) { const v = vs.find(v => v.name.toLowerCase().includes(voicePref.toLowerCase())); if (v) return v }
    return vs.find(v => /en-GB/i.test(v.lang) && /(daniel|george|arthur|male|oliver)/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs.find(v => /en[-_]/i.test(v.lang)) || vs[0]
  }
  try { speechSynthesis.onvoiceschanged = pickVoice } catch (e) { }
  function speak(text) {
    try {
      speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(String(text).replace(/[#*`>_]/g, '').replace(/\$(\d+)\/mo/g, '$1 dollars a month').slice(0, 700))
      const v = pickVoice(); if (v) u.voice = v; u.rate = 1.02
      u.onstart = () => { speaking = true; if (callActive) setCallState('speaking', 'Speaking'); if (cfg.hue) fetch('/api/hue').catch(() => {}) }
      u.onend = () => { speaking = false; if (callActive) callListen() }
      speechSynthesis.speak(u)
    } catch (e) { }
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  let rec = null, hands = false
  function mkRec(cont) { const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.continuous = cont; return r }
  // strict mode: only act when the assistant's name is spoken
  function nameHit(t) { const s = (t || '').toLowerCase(); const nm = (cfg.name || '').toLowerCase(); return s.includes('jarvis') || s.includes('synapse') || (nm.length > 2 && s.includes(nm)) }
  function strictOK(t) { return !cfg.strict || nameHit(t) }
  function startMic() {
    if (!SR) { alert('Voice input needs Chrome.'); return }
    $('#jarvis').classList.add('open')
    const r = mkRec(false); $('#jmic').classList.add('on'); $('#navvoice').classList.add('live')
    r.onresult = e => { $('#jq').value = e.results[0][0].transcript; ask() }
    r.onerror = r.onend = () => { $('#jmic').classList.remove('on'); $('#navvoice').classList.remove('live') }
    r.start()
  }
  $('#jmic').onclick = startMic
  $('#navvoice').onclick = startMic
  $('#jhands').onclick = () => {
    if (!SR) { alert('Voice needs Chrome.'); return }
    hands = !hands; $('#jhands').classList.toggle('on', hands)
    if (hands) { $('#jarvis').classList.add('open'); startHands() } else if (rec) { rec.stop(); rec = null }
  }
  function startHands() {
    rec = mkRec(true)
    rec.onresult = e => { if (speaking) return; const t = e.results[e.results.length - 1][0].transcript.trim(); if (t.length > 1 && strictOK(t)) { $('#jq').value = t; ask() } }
    rec.onend = () => { if (hands) { try { rec.start() } catch (e) { } } }
    try { rec.start() } catch (e) { }
  }
  // ---- guided tour of your own brain
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  function speakWait(text) {
    return new Promise(res => {
      try {
        speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(String(text).replace(/[#*`>_]/g, '')); const v = pickVoice(); if (v) u.voice = v; u.rate = 1.02
        let done = false; const fin = () => { if (!done) { done = true; res() } }
        u.onend = fin; u.onerror = fin; speaking = true; speechSynthesis.speak(u)
        setTimeout(fin, Math.min(9000, 1400 + text.length * 55))
      } catch (e) { setTimeout(res, 1500) }
    })
  }
  async function runTour() {
    const r = await (await fetch('/api/tour')).json()
    $('#jarvis').classList.add('open'); const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    for (const st of (r.steps || [])) {
      if (st.focus && st.focus.length) flyFire(st.focus)
      const el = document.createElement('div'); el.className = 'msg a'; el.textContent = st.say; log.appendChild(el); log.scrollTop = log.scrollHeight
      await speakWait(st.say); speaking = false; await sleep(350)
    }
  }
  // ---- brain stats (personal analytics)
  async function showStats() {
    const s = await (await fetch('/api/stats')).json()
    const g = s.growth || [0], gmax = Math.max(1, ...g)
    const fEntries = Object.entries(s.folders || {}).sort((a, b) => b[1] - a[1]); const fmax = Math.max(1, ...fEntries.map(x => x[1]))
    const bars = g.map(v => `<div class="gbar" style="height:${Math.round(v / gmax * 100)}%"></div>`).join('')
    const frows = fEntries.map(([f, c]) => `<div class="frow"><span>${f}</span><div class="fbar"><i style="width:${Math.round(c / fmax * 100)}%"></i></div><b>${c}</b></div>`).join('')
    const hubs = (s.topHubs || []).map(h => `<div class="frow"><span>${h.title}</span><b>${h.deg} links</b></div>`).join('') || '<div class="hint">none yet</div>'
    $('#statsBody').innerHTML =
      `<div class="snums">
         <div class="snum"><b>${s.notes}</b><span>${T('notes')}</span></div>
         <div class="snum"><b>${s.links}</b><span>${T('links')}</span></div>
         <div class="snum"><b>${(s.words / 1000).toFixed(1)}k</b><span>${T('s_words')}</span></div>
         <div class="snum"><b>${s.orphans}</b><span>${T('s_floating')}</span></div>
       </div>
       <div class="slbl">${T('s_growth')}</div><div class="growth">${bars}</div>
       <div class="slbl">${T('s_areas')}</div>${frows}
       <div class="slbl">${T('s_hubs')}</div>${hubs}`
    $('#stats').classList.add('open')
  }

  // ---- drop an image or a note to capture it (multimodal)
  function setupDrop() {
    const dz = $('#drop')
    window.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('open') })
    window.addEventListener('dragleave', e => { if (e.clientX <= 0 || e.clientY <= 0) dz.classList.remove('open') })
    window.addEventListener('drop', async e => {
      e.preventDefault(); dz.classList.remove('open')
      const f = e.dataTransfer.files[0]; if (!f) return
      dz.classList.add('open'); $('#dropText').textContent = 'Reading ' + f.name + '…'; dz.classList.add('busy')
      try {
        let text = null
        if (f.type.startsWith('image/')) {
          const img = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f) })
          $('#dropText').textContent = 'Looking at ' + f.name + '…'
          const vr = await (await fetch('/api/vision', { method: 'POST', body: JSON.stringify({ image: img, q: 'Describe this image in 2 or 3 sentences so it can be saved as a note. Start with a short title line.' }) })).json()
          text = vr.answer
        } else if (f.type.startsWith('text/') || /\.(md|markdown|txt)$/i.test(f.name)) {
          text = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(f) })
        } else { $('#dropText').textContent = 'Only images and text notes for now.'; setTimeout(() => dz.classList.remove('open', 'busy'), 1600); return }
        $('#dropText').textContent = 'Filing…'
        const cr = await (await fetch('/api/capture', { method: 'POST', body: JSON.stringify({ text }) })).json()
        dz.classList.remove('open', 'busy')
        if (cr.ok) { G = await (await fetch('/graph.json')).json(); build(); stat(); flyFire([cr.id]); const m = nodes.get(cr.id); if (m) openNode(m) }
      } catch (err) { $('#dropText').textContent = 'Could not read that.'; setTimeout(() => dz.classList.remove('open', 'busy'), 1600) }
    })
  }
  setupDrop()

  // ---- JARVIS actions (voice/text commands drive the whole app)
  function executeAction(a) {
    if (!a) return
    switch (a.type) {
      case 'cfg': if ('humor' in a) cfg.humor = a.humor; if (a.persona) cfg.persona = a.persona; if (a.model) cfg.model = a.model; break
      case 'voice': voicePref = a.name; break
      case 'nav': if (a.to === '3d') location.href = '/3d.html'; break
      case 'fit': $('#fit').click(); break
      case 'rescan': $('#rescan').click(); break
      case 'gaps': if (!ghosts.length) discover(); break
      case 'briefing': runBriefing(); break
      case 'theme': setTheme(a.mode); break
      case 'reminder': scheduleReminder(a); break
      case 'tasks': renderTasks(a.items); break
    }
  }
  function setTheme(mode) { document.documentElement.dataset.theme = mode }
  function scheduleReminder(a) {
    let delay = a.delayMs
    if (a.at) { let h = a.at.h; if (a.at.ap === 'pm' && h < 12) h += 12; if (a.at.ap === 'am' && h === 12) h = 0; const d = new Date(); d.setHours(h, a.at.m || 0, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); delay = d - new Date() }
    if (!(delay > 0)) delay = 60000
    setTimeout(() => fireReminder(a.text), delay)
  }
  function fireReminder(text) {
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const el = document.createElement('div'); el.className = 'card'; el.innerHTML = `<b>⏰ Reminder</b><a>${text}</a>`
    log.appendChild(el); log.scrollTop = log.scrollHeight
    speak('Reminder. ' + text)
  }
  function renderTasks(items) {
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    const wrap = document.createElement('div'); wrap.className = 'msg a'; wrap.innerHTML = `<b>${T('l_tasks')} (${items.length})</b>`
    const list = document.createElement('div'); list.className = 'gaps'
    items.forEach(it => { const row = document.createElement('div'); row.className = 'gap'; row.innerHTML = `<span>${it.task}</span><small>in ${it.title}</small>`; row.onclick = () => { const m = nodes.get(it.id); if (m) { flyFire([it.id]); openNode(m) } }; list.appendChild(row) })
    wrap.appendChild(list); log.appendChild(wrap); log.scrollTop = log.scrollHeight
  }

  async function ask() {
    const q = $('#jq').value.trim(); if (!q) return
    $('#jq').value = ''
    if (!$('#jarvis').classList.contains('open')) $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    log.insertAdjacentHTML('beforeend', `<div class="msg u"></div>`); log.lastChild.textContent = q
    log.insertAdjacentHTML('beforeend', `<div class="msg a">…</div>`); const el = log.lastChild; log.scrollTop = log.scrollHeight
    try {
      const r = await (await fetch('/api/ask', { method: 'POST', body: JSON.stringify({ q, lang: window.SYN_LANG() }) })).json()
      el.innerHTML = (r.answer || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')
      if (r.sources && r.sources.length) {
        const s = document.createElement('div'); s.className = 'src'
        r.sources.forEach(so => { const b = document.createElement('span'); b.textContent = so.title; b.onclick = () => { const m = nodes.get(so.id); if (m) { flyFire([so.id]); openNode(m) } }; s.appendChild(b) })
        el.appendChild(s)
      }
      if (r.learned) { const b = document.createElement('div'); b.className = 'learned'; b.textContent = '🧠 '+T('l_remember')+': ' + r.learned; el.appendChild(b) }
      if (r.card && r.card.items && r.card.items.length) {
        const c = document.createElement('div'); c.className = 'card'
        c.innerHTML = '<button class="cardx" title="Dismiss">×</button><b>' + (r.card.title || 'What I found') + '</b>' + r.card.items.map(it => `<a href="${it.url}" target="_blank" rel="noopener">${it.title}<small>${(it.url || '').slice(0, 60)}</small></a>`).join('')
        c.querySelector('.cardx').onclick = () => c.remove()
        log.appendChild(c)
      }
      if (callActive) $('#ccap').textContent = r.answer || ''
      flyFire(r.focus)
      speak(r.spoken || r.answer)
      executeAction(r.action)
    } catch (e) { el.textContent = 'JARVIS offline: ' + e.message }
    log.scrollTop = log.scrollHeight
  }
  $('#jsend').onclick = ask
  $('#jq').addEventListener('keydown', e => { if (e.key === 'Enter') ask() })

  // ---- rail features
  $('#navgaps').onclick = discover
  $('#navtoday').onclick = runToday
  $('#navcapture').onclick = openCapture

  // ---- Today's focus (personal, read from your own brain)
  async function runToday() {
    const r = await (await fetch('/api/today')).json()
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    const el = document.createElement('div'); el.className = 'msg a'; el.innerHTML = '<b>'+T('today')+'</b><br>' + (r.answer || '').replace(/\n/g, '<br>')
    log.appendChild(el); log.scrollTop = log.scrollHeight
    flyFire(r.focus); speak(r.spoken || r.answer)
  }
  // ---- Quick Capture (a raw thought, filed and linked for you)
  function openCapture() { $('#capture').classList.add('open'); setTimeout(() => $('#cin').focus(), 30); $('#chint').textContent = '' }
  function closeCapture() { $('#capture').classList.remove('open') }
  $('#capture').addEventListener('click', e => { if (e.target.id === 'capture') closeCapture() })
  $('#cin').addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') doCapture(); if (e.key === 'Escape') closeCapture() })
  $('#cgo').onclick = doCapture
  $('#cmic').onclick = () => { if (!SR) { alert('Voice needs Chrome.'); return } const r = mkRec(false); $('#cmic').classList.add('on'); r.onresult = e => { $('#cin').value = ($('#cin').value + ' ' + e.results[0][0].transcript).trim() }; r.onerror = r.onend = () => $('#cmic').classList.remove('on'); r.start() }
  async function doCapture() {
    const t = $('#cin').value.trim(); if (!t) return
    $('#chint').textContent = 'Filing…'
    try {
      const r = await (await fetch('/api/capture', { method: 'POST', body: JSON.stringify({ text: t }) })).json()
      if (r.ok) { G = await (await fetch('/graph.json')).json(); build(); stat(); $('#cin').value = ''; closeCapture(); flyFire([r.id]); const m = nodes.get(r.id); if (m) openNode(m) }
      else $('#chint').textContent = 'Nothing to file.'
    } catch (e) { $('#chint').textContent = 'Could not file: ' + e.message }
  }
  $('#navvision').onclick = seeScreen
  async function seeScreen() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) { alert('Screen vision needs a browser with screen sharing.'); return }
    let stream
    try { stream = await navigator.mediaDevices.getDisplayMedia({ video: true }) } catch (e) { return }
    const video = document.createElement('video'); video.srcObject = stream; await video.play()
    await new Promise(r => setTimeout(r, 350))
    const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight; c.getContext('2d').drawImage(video, 0, 0)
    stream.getTracks().forEach(t => t.stop())
    const img = c.toDataURL('image/jpeg', 0.7)
    $('#jarvis').classList.add('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    log.insertAdjacentHTML('beforeend', `<div class="msg a">Looking at your screen…</div>`); const el = log.lastChild; log.scrollTop = log.scrollHeight
    try { const r = await (await fetch('/api/vision', { method: 'POST', body: JSON.stringify({ image: img, q: '' }) })).json(); el.innerHTML = '<b>Screen</b><br>' + (r.answer || '').replace(/[<>]/g, x => ({ '<': '&lt;', '>': '&gt;' }[x])); speak(r.spoken || r.answer) }
    catch (e) { el.textContent = 'Vision offline: ' + e.message }
    log.scrollTop = log.scrollHeight
  }

  // ---- settings (tune JARVIS at runtime)
  const setpop = $('#setpop')
  $('#navset').onclick = () => {
    setpop.classList.toggle('open')
    if (setpop.classList.contains('open')) { $('#setPersona').value = cfg.persona || ''; $('#setHumor').value = cfg.humor ?? 25; $('#humVal').textContent = cfg.humor ?? 25; $('#setModel').value = cfg.model || ''; updateConn(cfg.jarvis) }
  }
  function updateConn(ok) { const c = $('#conn'); if (!c) return; c.classList.toggle('ok', !!ok); $('#connTxt').textContent = ok ? T('t_conn1') : T('t_conn0') }
  $('#setHumor').addEventListener('input', e => $('#humVal').textContent = e.target.value)
  $('#setSave').onclick = async () => {
    const body = { persona: $('#setPersona').value, humor: +$('#setHumor').value, model: $('#setModel').value }
    if ($('#setKey').value.trim()) body.ai_key = $('#setKey').value.trim()
    if ($('#setOR').value.trim()) body.openrouter_key = $('#setOR').value.trim()
    cfg.persona = body.persona; cfg.humor = body.humor; cfg.model = body.model
    const r = await (await fetch('/api/set', { method: 'POST', body: JSON.stringify(body) })).json()
    cfg.jarvis = r.jarvis; updateConn(r.jarvis); $('#setKey').value = ''; $('#setOR').value = ''
    setpop.classList.remove('open')
    const log = $('#jlog'); const hint = log.querySelector('.hint'); if (hint) hint.remove()
    log.insertAdjacentHTML('beforeend', `<div class="msg a"><b>JARVIS</b><br>${r.jarvis ? 'Connected and recalibrated. I am fully online.' : 'Settings saved. Add a key to bring me fully online.'}</div>`); log.scrollTop = log.scrollHeight
  }

  // ---- Call JARVIS (live voice conversation)
  let callActive = false, callRec = null, callBusy = false
  $('#navcall').onclick = callStart
  $('#callend').onclick = callEnd
  function setCallState(s, label) { const c = $('#call'); c.classList.remove('listening', 'thinking', 'speaking'); c.classList.add(s); const K = { listening: 'st_listen', thinking: 'st_think', speaking: 'st_speak' }; $('#cstate').textContent = K[s] ? T(K[s]) : (label || s) }
  let rtpc = null, rtStream = null
  function callStart() {
    if (cfg.realtime) return realtimeCall()   // GPT Realtime engine when enabled
    if (!SR) { alert('Live call needs a browser with speech recognition (Chrome).'); return }
    callActive = true; $('#call').classList.add('open'); $('#ccap').textContent = ''
    setCallState('speaking', 'Speaking'); speak('JARVIS online. How can I help?'); startMeter()
  }
  function callEnd() { callActive = false; try { callRec && callRec.stop() } catch (e) { } try { speechSynthesis.cancel() } catch (e) { } stopMeter(); realtimeEnd(); $('#call').classList.remove('open') }
  // GPT Realtime: low-latency native voice call over WebRTC
  async function realtimeCall() {
    $('#call').classList.add('open'); $('#ccap').textContent = 'Realtime voice'; setCallState('speaking', T('c_connecting'))
    try {
      const tok = await (await fetch('/api/realtime-token')).json()
      const key = tok.client_secret && tok.client_secret.value
      if (!key) { setCallState('listening', 'Add an OpenAI key to use Realtime'); return }
      callActive = true
      rtpc = new RTCPeerConnection()
      const audioEl = document.createElement('audio'); audioEl.autoplay = true; document.body.appendChild(audioEl); rtpc._audio = audioEl
      rtpc.ontrack = e => { audioEl.srcObject = e.streams[0]; setCallState('speaking', 'Speaking') }
      rtStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      rtStream.getTracks().forEach(t => rtpc.addTrack(t, rtStream))
      const dc = rtpc.createDataChannel('oai-events'); dc.onopen = () => setCallState('listening', 'Listening')
      const offer = await rtpc.createOffer(); await rtpc.setLocalDescription(offer)
      const r = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', { method: 'POST', body: offer.sdp, headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/sdp' } })
      await rtpc.setRemoteDescription({ type: 'answer', sdp: await r.text() })
    } catch (e) { setCallState('listening', 'Realtime failed: ' + e.message) }
  }
  function realtimeEnd() { try { rtpc && rtpc.close() } catch (e) { } if (rtpc && rtpc._audio) rtpc._audio.remove(); rtpc = null; if (rtStream) rtStream.getTracks().forEach(t => t.stop()); rtStream = null }
  // real mic amplitude drives the orb + waveform (WebAudio)
  let audioCtx = null, micStream = null, meterRAF = null
  async function startMeter() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const src = audioCtx.createMediaStreamSource(micStream), an = audioCtx.createAnalyser(); an.fftSize = 64; src.connect(an)
      const data = new Uint8Array(an.frequencyBinCount), bars = [...$('#wave').children], orb = $('#call').querySelector('.corb span')
      const tick = () => {
        an.getByteFrequencyData(data); let s = 0; for (const v of data) s += v; const amp = s / data.length / 255
        if (orb) orb.style.transform = 'scale(' + (1 + amp * 0.6) + ')'
        bars.forEach((b, i) => { const v = data[i % data.length] / 255; b.style.height = (6 + v * 28) + 'px'; b.style.opacity = (0.4 + v * 0.6) })
        meterRAF = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) { }   // no mic permission -> CSS fallback animation
  }
  function stopMeter() {
    if (meterRAF) cancelAnimationFrame(meterRAF); meterRAF = null
    if (micStream) micStream.getTracks().forEach(t => t.stop()); micStream = null
    if (audioCtx) { try { audioCtx.close() } catch (e) { } audioCtx = null }
    const orb = $('#call') && $('#call').querySelector('.corb span'); if (orb) orb.style.transform = ''
    if ($('#wave')) [...$('#wave').children].forEach(b => { b.style.height = ''; b.style.opacity = '' })
  }
  function callListen() {
    if (!callActive) return
    callBusy = false; setCallState('listening', 'Listening'); callRec = mkRec(true)
    callRec.onresult = e => { if (speaking) return; const t = e.results[e.results.length - 1][0].transcript.trim(); if (t.length > 1 && strictOK(t)) { $('#ccap').textContent = t; callBusy = true; setCallState('thinking', 'Thinking'); try { callRec.stop() } catch (e) { }; $('#jq').value = t; ask() } }
    callRec.onerror = () => { }
    callRec.onend = () => { if (callActive && !callBusy && !speaking) { try { callRec.start() } catch (e) { } } }
    try { callRec.start() } catch (e) { }
  }
  document.addEventListener('click', e => { if (!setpop.contains(e.target) && e.target.id !== 'navset' && !$('#navset').contains(e.target)) setpop.classList.remove('open') })

  // ---- neural-activity sparkline in the HUD
  const sp = $('#spark'), spc = sp.getContext('2d'); sp.width = 96 * DPR; sp.height = 30 * DPR; spc.setTransform(DPR, 0, 0, DPR, 0, 0)
  const hist = new Array(48).fill(0)
  function drawSpark() {
    hist.push(Math.min(1, alpha * 1.4 + fires.length * 0.08 + pulses.size * 0.1)); hist.shift()
    spc.clearRect(0, 0, 96, 30)
    spc.beginPath()
    hist.forEach((v, i) => { const x = i / (hist.length - 1) * 96, y = 28 - v * 24; i ? spc.lineTo(x, y) : spc.moveTo(x, y) })
    spc.strokeStyle = A; spc.lineWidth = 1.4; spc.stroke()
    spc.lineTo(96, 30); spc.lineTo(0, 30); spc.closePath()
    const g = spc.createLinearGradient(0, 0, 0, 30); g.addColorStop(0, A + '44'); g.addColorStop(1, A + '00'); spc.fillStyle = g; spc.fill()
    requestAnimationFrame(drawSpark)
  }
  drawSpark()

  // ---- boot sequence
  const bootLines = ['booting neural core', 'reading your vault', `${G.meta.count} notes online`, 'JARVIS ready']
  let bi = 0
  function typeBoot() {
    if (bi >= bootLines.length) { $('#boot').classList.add('gone'); setTimeout(() => $('#boot').remove(), 800); speakReady(); return }
    $('#bootLine').textContent = bootLines[bi++]; setTimeout(typeBoot, 460)
  }
  let readyDone = false
  function speakReady() { if (readyDone) return; readyDone = true }
  setTimeout(typeBoot, 300)

  // ---- export the brain as a PNG
  function exportPNG() {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height
    const x = c.getContext('2d')
    x.fillStyle = getComputedStyle(document.body).backgroundColor || '#060912'; x.fillRect(0, 0, c.width, c.height)
    x.drawImage(fx, 0, 0); x.drawImage(cv, 0, 0)
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = (cfg.name || 'synapse').toLowerCase() + '-brain.png'; a.click()
  }
  $('#navexport').onclick = exportPNG

  // ---- command palette (Cmd/Ctrl + K)
  const COMMANDS = [
    { t: 'Ask JARVIS', k: 'chat', run: () => $('#jarvis').classList.add('open') },
    { t: 'Call JARVIS (live voice)', k: 'voice', run: callStart },
    { t: 'Quick capture (file a thought)', k: 'capture', run: openCapture },
    { t: "Today's focus", k: 'focus', run: runToday },
    { t: 'Rediscover (resurface an old note)', k: 'memory', run: runRediscover },
    { t: 'Take a guided tour of my brain', k: 'tour', run: runTour },
    { t: 'Brain stats (analytics)', k: 'stats', run: showStats },
    { t: 'Brain Gaps (missing links)', k: 'analyze', run: () => { if (!ghosts.length) discover() } },
    { t: 'Apply all missing links', k: 'tidy', run: applyAllLinks },
    { t: 'Daily Briefing', k: 'brief', run: runBriefing },
    { t: 'Voice input', k: 'voice', run: startMic },
    { t: 'See screen', k: 'vision', run: seeScreen },
    { t: 'Find path between two notes', k: 'graph', run: startPath },
    { t: 'Focus a note (isolate)', k: 'graph', run: startFocus },
    { t: 'Cluster by theme (toggle colours)', k: 'graph', run: () => { clusterMode = !clusterMode } },
    { t: 'Clear focus / path', k: 'graph', run: clearFocus },
    { t: 'Export brain as PNG', k: 'export', run: exportPNG },
    { t: 'Open 3D brain', k: 'view', run: () => location.href = '/3d.html' },
    { t: 'Fit view', k: 'view', run: () => $('#fit').click() },
    { t: 'Rescan vault', k: 'view', run: () => $('#rescan').click() },
    { t: 'Dark mode', k: 'theme', run: () => setTheme('dark') },
    { t: 'Light mode', k: 'theme', run: () => setTheme('light') },
    { t: 'Tune JARVIS', k: 'config', run: () => $('#navset').click() },
    ...(vaultInfo.vaults.length > 1 ? vaultInfo.vaults.map(v => ({ t: 'Switch to vault: ' + v.name, k: 'vault', run: () => switchVault(v.idx) })) : []),
  ]
  async function switchVault(idx) {
    const r = await (await fetch('/api/switch', { method: 'POST', body: JSON.stringify({ idx }) })).json()
    if (r.ok) { G = await (await fetch('/graph.json')).json(); clearFocus(); build(); stat(); cam.z = 0.7 }
  }
  let palItems = [], palSel = 0
  function openPalette() { $('#palette').classList.add('open'); $('#pin').value = ''; renderPalette(''); setTimeout(() => $('#pin').focus(), 30) }
  function closePalette() { $('#palette').classList.remove('open') }
  function renderPalette(q) {
    q = q.toLowerCase().trim()
    const cmds = COMMANDS.filter(c => !q || c.t.toLowerCase().includes(q)).map(c => ({ label: c.t, kind: c.k, note: false, run: c.run }))
    const notes = [...nodes.values()].sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
      .filter(n => !q || (n.title + ' ' + (n.tags || []).join(' ')).toLowerCase().includes(q))
      .slice(0, q ? 8 : 5).map(n => ({ label: n.title, kind: n.folder, note: true, run: () => { flyFire([n.id]); openNode(n) } }))
    palItems = q ? [...cmds, ...notes] : [...cmds.slice(0, 7), ...notes]
    palSel = 0
    $('#plist').innerHTML = palItems.map((it, i) => `<div class="pitem${i === 0 ? ' sel' : ''}" data-i="${i}"><span>${it.label}</span><span class="pk">${it.note ? 'note · ' + it.kind : it.kind}</span></div>`).join('')
    $('#plist').querySelectorAll('.pitem').forEach(el => { el.onmouseenter = () => { palSel = +el.dataset.i; updateSel() }; el.onclick = () => runPal(+el.dataset.i) })
  }
  function updateSel() { const els = $('#plist').querySelectorAll('.pitem'); els.forEach((el, i) => el.classList.toggle('sel', i === palSel)); if (els[palSel]) els[palSel].scrollIntoView({ block: 'nearest' }) }
  function runPal(i) { const it = palItems[i]; if (!it) return; closePalette(); it.run() }
  $('#pin').addEventListener('input', e => renderPalette(e.target.value))
  $('#pin').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); updateSel() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); updateSel() }
    else if (e.key === 'Enter') { e.preventDefault(); runPal(palSel) }
    else if (e.key === 'Escape') closePalette()
  })
  $('#navcmd').onclick = openPalette
  $('#palette').addEventListener('click', e => { if (e.target.id === 'palette') closePalette() })

  // ---- welcome / explainer (first run + help command)
  function showWelcome() { $('#welcome').classList.add('open') }
  $('#wgo').onclick = () => { $('#welcome').classList.remove('open'); try { localStorage.setItem('synapse_seen', '1') } catch (e) { } }
  $('#welcome').addEventListener('click', e => { if (e.target.id === 'welcome') $('#welcome').classList.remove('open') })
  let seen = false; try { seen = !!localStorage.getItem('synapse_seen') } catch (e) { }
  if (!seen) setTimeout(showWelcome, 2700)   // after the boot sequence
  COMMANDS.push({ t: 'What is SYNAPSE? (help)', k: 'help', run: showWelcome })
  $('#wtour').onclick = () => { $('#welcome').classList.remove('open'); try { localStorage.setItem('synapse_seen', '1') } catch (e) { } runTour() }
  $('#stats').addEventListener('click', e => { if (e.target.id === 'stats' || e.target.id === 'statsClose') $('#stats').classList.remove('open') })
  window.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#palette').classList.contains('open') ? closePalette() : openPalette() } })

  // language switcher + copyright
  document.querySelectorAll('.langopt').forEach(o => o.onclick = () => setLang(o.dataset.lang))
  // guide / help (self-explaining, skippable, language changeable inside)
  { const g = $('#guide'), openG = () => g && g.classList.add('open'), closeG = () => g && g.classList.remove('open')
    const hb = $('#help'); if (hb) hb.onclick = openG
    const wg = $('#wguide'); if (wg) wg.onclick = openG
    const gc = $('#gclose'); if (gc) gc.onclick = closeG
    if (g) g.addEventListener('click', e => { if (e.target.id === 'guide') closeG() })
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeG() }) }
  { const cr = $('#credit'), wc = $('#wcredit'); if (cr) cr.href = LINKEDIN; if (wc) wc.href = LINKEDIN }
  applyLang()

  build(); stat(); cam.x = W / 2; cam.y = H / 2; cam.z = REDUCED ? 0.72 : 0.28; draw()
  if (!REDUCED) setTimeout(() => animateCam(W / 2, H / 2, 0.72), 720)   // cinematic zoom-in reveal
  // shareable deep link: open #note=<id> on load
  { const hm = (location.hash || '').match(/note=([^&]+)/); if (hm) { const id = decodeURIComponent(hm[1]); const m = nodes.get(id); if (m) setTimeout(() => { flyFire([id]); openNode(m) }, REDUCED ? 120 : 1500) } }
  // empty vault: gentle prompt instead of a blank void
  if (!G.meta.count) { $('#jarvis').classList.add('open'); const log = $('#jlog'); log.innerHTML = '<div class="hint">Your vault is empty. Hit Quick Capture (＋) or drop a note to plant your first thought.</div>' }
})()
