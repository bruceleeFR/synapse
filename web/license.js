/* SYNAPSE license gate — activate at startup. Keys are minted with: python3 synapse.py --genkey */
(function () {
  window.SYN_SKOOL = 'https://www.skool.com/house-of-lamarca-'
  const AL = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 31 chars, no confusing 0 O 1 I
  function chk(p) { let s = 0; for (let i = 0; i < p.length; i++) s += (AL.indexOf(p[i]) + 1) * (i + 2); return AL[s % AL.length] }
  window.SYN_validateKey = function (k) {
    k = (k || '').toUpperCase().trim()
    const m = k.match(/^LAMARCA-([A-Z0-9]{5})([A-Z0-9])$/)
    if (!m) return false
    if (![...m[1]].every(c => AL.includes(c))) return false
    return chk(m[1]) === m[2]
  }
  function activated() { try { const k = localStorage.getItem('synapse_license'); return !!(k && window.SYN_validateKey(k)) } catch (e) { return false } }
  function showGate() {
    const el = document.getElementById('license'); if (!el) return
    el.classList.add('open')
    const inp = document.getElementById('licin'), btn = document.getElementById('licgo'), msg = document.getElementById('licmsg'), get = document.getElementById('licget'), cr = document.getElementById('liccreditlink')
    if (get) get.href = window.SYN_SKOOL
    if (cr && window.SYN_LINKEDIN) cr.href = window.SYN_LINKEDIN
    function go() {
      const k = (inp.value || '').toUpperCase().trim()
      if (!window.SYN_validateKey(k)) { msg.textContent = window.SYN_T ? window.SYN_T('lic_invalid') : 'Invalid key.'; return }
      // unlock the server too (the app is locked until a valid key is registered)
      fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) })
        .then(r => r.json()).then(d => {
          if (d && (d.licensed || d.ok)) { try { localStorage.setItem('synapse_license', k) } catch (e) { } el.classList.remove('open') }
          else { msg.textContent = window.SYN_T ? window.SYN_T('lic_invalid') : 'Invalid key.' }
        })
        .catch(() => { try { localStorage.setItem('synapse_license', k) } catch (e) { } el.classList.remove('open') })
    }
    btn.onclick = go
    inp.onkeydown = e => { if (e.key === 'Enter') go() }
    setTimeout(() => inp.focus(), 60)
  }
  function boot() {
    if (window.SYN_applyLang) window.SYN_applyLang()
    if (activated()) {
      // sync the server lock on a fresh install or a new browser that already holds a key
      const k = localStorage.getItem('synapse_license')
      fetch('/api/activate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: k }) }).catch(() => { })
      return
    }
    showGate()
    // Public demo instances (and an already-licensed server) lift the gate.
    fetch('/config.json').then(r => r.json()).then(c => { if (c.demo || c.licensed) { const el = document.getElementById('license'); if (el) el.classList.remove('open') } }).catch(() => { })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot()
})()
