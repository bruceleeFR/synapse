#!/usr/bin/env python3
"""
SYNAPSE — your second brain as a living graph.

Point it at any folder of markdown notes. It reads the [[wikilinks]], tags and
folders, builds a rich graph, and serves an immersive 2D and 3D brain in your
browser, with a JARVIS panel that answers from your own notes.

No database, no build step, no dependencies beyond Python 3.

    python3 synapse.py [VAULT_FOLDER] [--port 4711] [--no-open]

The graph is a window into plain files. Edit the notes, refresh, done.
"""
import os, re, sys, json, html, http.server, socketserver, threading, webbrowser, urllib.request, urllib.error, urllib.parse, mimetypes, subprocess, platform, glob

if getattr(sys, "frozen", False):
    # packaged as a desktop app (.exe / .app) via PyInstaller
    ROOT = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
else:
    ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, "web")

# ----------------------------------------------------------------------------- scan
WIKILINK = re.compile(r"\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]")
TAG = re.compile(r"(?:^|\s)#([A-Za-z0-9][\w/-]{1,40})")
FRONTMATTER = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
H1 = re.compile(r"^#\s+(.+)$", re.M)

def read(path):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""

def title_of(path, text):
    m = FRONTMATTER.match(text)
    if m:
        mt = re.search(r"^title:\s*(.+)$", m.group(1), re.M)
        if mt:
            return mt.group(1).strip().strip('"\'')
    m = H1.search(text)
    if m:
        return m.group(1).strip()
    return os.path.splitext(os.path.basename(path))[0]

def excerpt(text):
    body = FRONTMATTER.sub("", text)
    body = re.sub(r"^#.*$", "", body, flags=re.M)          # drop headings
    body = re.sub(r"\[\[([^\]|#]+)(?:[|][^\]]*)?\]\]", r"\1", body)  # unwrap links
    body = re.sub(r"[#*`>_\-]", " ", body)
    body = re.sub(r"\s+", " ", body).strip()
    return body[:240]

def scan(vault):
    files = []
    for dp, dn, fn in os.walk(vault):
        dn[:] = [d for d in dn if not d.startswith(".") and d not in ("node_modules", "__pycache__")]
        for f in fn:
            if f.lower().endswith((".md", ".markdown")):
                files.append(os.path.join(dp, f))
    notes, by_key = [], {}
    for path in files:
        text = read(path)
        rel = os.path.relpath(path, vault)
        folder = os.path.dirname(rel).split(os.sep)[0] if os.sep in rel else "root"
        title = title_of(path, text)
        tags = sorted(set(t.lower() for t in TAG.findall(text)))
        links = [l.strip() for l in WIKILINK.findall(text)]
        words = len(re.findall(r"\w+", text))
        try:
            mtime = int(os.path.getmtime(path))
        except Exception:
            mtime = 0
        note = {
            "id": rel, "title": title, "folder": folder or "root", "tags": tags,
            "excerpt": excerpt(text), "words": words, "outlinks_raw": links, "mtime": mtime,
        }
        notes.append(note)
        for key in {title.lower(), os.path.splitext(os.path.basename(path))[0].lower()}:
            by_key[key] = rel
    # resolve links -> edges
    edges, backlinks = [], {n["id"]: [] for n in notes}
    idset = {n["id"] for n in notes}
    for n in notes:
        seen = set()
        for l in n["outlinks_raw"]:
            tgt = by_key.get(l.lower())
            if tgt and tgt != n["id"] and (n["id"], tgt) not in seen:
                edges.append({"source": n["id"], "target": tgt})
                seen.add((n["id"], tgt))
                backlinks[tgt].append(n["id"])
    deg = {n["id"]: 0 for n in notes}
    for e in edges:
        deg[e["source"]] += 1; deg[e["target"]] += 1
    folders = sorted(set(n["folder"] for n in notes))
    alltags = sorted(set(t for n in notes for t in n["tags"]))
    for n in notes:
        n["deg"] = deg[n["id"]]
        n["backlinks"] = backlinks[n["id"]]
        del n["outlinks_raw"]
    return {
        "meta": {"vault": os.path.abspath(vault), "count": len(notes),
                 "edges": len(edges), "folders": folders, "tags": alltags},
        "nodes": notes, "edges": edges,
    }

SAVE_FIELDS = ("name", "accent", "accent2", "logo", "persona", "humor", "model", "provider", "voice", "ai_key", "openrouter_key")

def save_config(vault, cfg):
    data = {k: cfg.get(k) for k in SAVE_FIELDS if cfg.get(k) not in (None, "")}
    try:
        with open(os.path.join(vault, "config.json"), "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return True
    except Exception:
        return False

def load_config(vault):
    cfg = {"name": "SYNAPSE", "accent": "#5b8bff", "accent2": "#8f6bff", "logo": "",
           "persona": "JARVIS, a calm, precise British butler assistant",
           "humor": 25, "model": "gpt-4o-mini", "provider": "openai",
           "openrouter_key": "", "ai_key": "", "voice": "British",
           "allow_os": False, "strict": False, "realtime": False, "demo": False,
           "hue_bridge": "", "hue_user": "", "hue_lights": []}
    for base in (vault, ROOT):
        p = os.path.join(base, "config.json")
        if os.path.exists(p):
            try:
                cfg.update(json.load(open(p)))
            except Exception:
                pass
    return cfg

# ----------------------------------------------------------------------------- jarvis
def env_key():
    if os.environ.get("SYNAPSE_DEMO") == "1":
        return None  # never lend a paid key to an unauthenticated public demo
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    if os.path.exists("/etc/citerank-api.env"):
        m = re.search(r"OPENAI_API_KEY=(sk-[A-Za-z0-9_-]+)", read("/etc/citerank-api.env"))
        if m:
            return m.group(1)
    return None

def note_text(vault, nid):
    return read(os.path.join(vault, nid))

def memory_path(vault):
    return os.path.join(vault, "jarvis-memory.md")

def read_memory(vault):
    p = memory_path(vault)
    return read(p).strip() if os.path.exists(p) else ""

def add_memory(vault, line):
    p = memory_path(vault)
    with open(p, "a", encoding="utf-8") as f:
        if not os.path.exists(p) or os.path.getsize(p) == 0:
            f.write("# What JARVIS knows about you\n\n")
        f.write("- " + line.strip() + "\n")

def retrieve(graph, vault, question, k=6):
    qterms = set(re.findall(r"\w+", question.lower()))
    scored = []
    for n in graph["nodes"]:
        blob = (n["title"] + " " + n["excerpt"] + " " + " ".join(n["tags"])).lower()
        score = sum(blob.count(t) for t in qterms) + 2 * sum(1 for t in qterms if t in n["title"].lower())
        if score:
            scored.append((score, n))
    scored.sort(key=lambda x: -x[0])
    return [n for _, n in scored[:k]]

def web_search(query, n=5):
    try:
        data = urllib.parse.urlencode({"q": query}).encode()
        req = urllib.request.Request("https://html.duckduckgo.com/html/", data=data,
            headers={"User-Agent": "Mozilla/5.0"})
        htmltext = urllib.request.urlopen(req, timeout=20).read().decode("utf-8", "ignore")
        out = []
        for m in re.finditer(r'result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', htmltext):
            url = urllib.parse.unquote(re.sub(r".*uddg=", "", m.group(1)))
            title = re.sub(r"<[^>]+>", "", m.group(2))
            out.append({"title": html.unescape(title), "url": url})
            if len(out) >= n:
                break
        return out
    except Exception:
        return []

def llm(cfg, model, messages, key_override=""):
    model = model or cfg.get("model") or "gpt-4o-mini"
    # OpenRouter when model has a "/" (vendor/model) and a key exists
    if "/" in model and (cfg.get("openrouter_key") or key_override):
        k = key_override or cfg["openrouter_key"]
        url = "https://openrouter.ai/api/v1/chat/completions"
    else:
        k = cfg.get("ai_key") or env_key()
        url = "https://api.openai.com/v1/chat/completions"
    if not k:
        return None
    body = json.dumps({"model": model, "messages": messages, "temperature": 0.3}).encode()
    try:
        req = urllib.request.Request(url, data=body, headers={"Authorization": "Bearer " + k, "Content-Type": "application/json"})
        r = urllib.request.urlopen(req, timeout=70)
        return json.loads(r.read())["choices"][0]["message"]["content"]
    except Exception as e:
        return "JARVIS could not reach the model: " + str(e)[:140]

def vision_answer(cfg, image, q):
    key = cfg.get("ai_key") or env_key()
    if not key:
        return {"answer": "Add an OpenAI key to config.json to use screen vision.", "spoken": "Add an A I key for screen vision."}
    body = json.dumps({"model": "gpt-4o", "temperature": 0.2, "max_tokens": 320, "messages": [
        {"role": "system", "content": "You are JARVIS, looking at the user's screen. Say what matters and answer concisely, as if spoken aloud."},
        {"role": "user", "content": [
            {"type": "text", "text": q or "What is on my screen? Anything I should act on?"},
            {"type": "image_url", "image_url": {"url": image}}]}]}).encode()
    try:
        req = urllib.request.Request("https://api.openai.com/v1/chat/completions", data=body,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
        ans = json.loads(urllib.request.urlopen(req, timeout=70).read())["choices"][0]["message"]["content"]
        return {"answer": ans, "spoken": ans}
    except Exception as e:
        return {"answer": "Vision failed: " + str(e)[:160], "spoken": "I could not read the screen."}

LANG_NAME = {"en": "English", "fr": "French", "ru": "Russian", "zh": "Chinese"}

def system_prompt(cfg, memory, lang=""):
    persona = cfg.get("persona", "JARVIS, a calm British assistant")
    humor = int(cfg.get("humor", 25))
    tone = "Keep it witty and playful." if humor >= 70 else ("A light touch of dry wit is welcome." if humor >= 35 else "Stay crisp and professional.")
    mem = f"\n\nWhat you already know about the user:\n{memory}" if memory else ""
    ln = f" Always answer in {LANG_NAME[lang]}." if lang in LANG_NAME and lang != "en" else ""
    return (f"You are {persona}. You are the voice of the user's personal second brain. "
            f"Answer from the provided notes (and web results when given). Be concise, direct, spoken aloud. "
            f"{tone} If the notes do not cover it, say so plainly.{ln}{mem}")

def scan_tasks(vault, graph, limit=24):
    out = []
    for n in graph["nodes"]:
        t = note_text(vault, n["id"])
        for m in re.finditer(r"^[\s>]*[-*] \[ \]\s+(.+)$", t, re.M):
            task = re.sub(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]", r"\1", m.group(1)).strip()
            out.append({"id": n["id"], "title": n["title"], "task": task})
            if len(out) >= limit:
                return out
    return out

MODEL_ALIASES = {"grok": "x-ai/grok-2", "gpt-4o": "gpt-4o", "gpt4o": "gpt-4o", "gpt": "gpt-4o-mini",
                 "haiku": "anthropic/claude-3.5-haiku", "sonnet": "anthropic/claude-3.7-sonnet",
                 "opus": "anthropic/claude-3-opus", "gemini": "google/gemini-flash-1.5", "mini": "gpt-4o-mini"}
PERSONAS = {"pirate": "a swashbuckling pirate who still answers accurately",
            "glados": "GLaDOS, a coldly sarcastic AI from Aperture Science",
            "yoda": "Yoda, who speaks in inverted phrasing",
            "butler": "JARVIS, a calm, precise British butler assistant",
            "coach": "an upbeat motivational coach"}

def command_intent(q, cfg, graph, vault):
    """Instant voice/text commands: tune JARVIS, drive the app, set reminders, list tasks. No LLM."""
    ql = (q or "").lower().strip()
    def ack(ans, spoken=None, action=None):
        return {"answer": ans, "spoken": spoken or ans, "sources": [], "focus": [], "action": action}
    # ---- humour
    m = re.search(r"humou?r (?:to |at |up to )?(\d{1,3})", ql)
    if m:
        h = max(0, min(100, int(m.group(1)))); cfg["humor"] = h
        return ack(f"Humour set to {h}.", None, {"type": "cfg", "humor": h})
    if re.search(r"\b(funnier|more funny)\b", ql):
        h = min(100, int(cfg.get("humor", 25)) + 25); cfg["humor"] = h; return ack(f"Turning it up. Humour {h}.", None, {"type": "cfg", "humor": h})
    if re.search(r"\b(less funny|more serious|be serious)\b", ql):
        h = max(0, int(cfg.get("humor", 25)) - 25); cfg["humor"] = h; return ack(f"Dialling it back. Humour {h}.", None, {"type": "cfg", "humor": h})
    # ---- personas
    m = re.search(r"\b(pirate|glados|yoda|butler|coach)\b", ql)
    if m and re.search(r"\b(mode|persona|switch|become|talk like|be |act like|go )", ql):
        p = PERSONAS[m.group(1)]; cfg["persona"] = p
        return ack(f"Persona engaged. I am now {p}.", "Persona engaged.", {"type": "cfg", "persona": p})
    # ---- voice
    m = re.search(r"(?:switch |change |set )?voice to (\w+)", ql)
    if m:
        return ack(f"Voice set to {m.group(1)}.", None, {"type": "voice", "name": m.group(1)})
    # ---- model hot-swap
    if re.search(r"back to (?:my |the )?(usual|normal|default|regular) (?:brain|model|self)", ql):
        cfg["model"] = "gpt-4o-mini"; return ack("Back to the usual brain.", None, {"type": "cfg", "model": "gpt-4o-mini"})
    m = re.search(r"(?:try(?: on)?|switch to|use|run on|put on|think on) (?:the )?(grok|gpt-4o|gpt4o|gpt|haiku|sonnet|opus|gemini|mini)\b", ql)
    if m:
        mdl = MODEL_ALIASES[m.group(1)]; cfg["model"] = mdl
        return ack(f"Now thinking on {mdl}.", f"Switched brain to {m.group(1)}.", {"type": "cfg", "model": mdl})
    # ---- app control
    if re.search(r"\b(3d|three ?d)\b", ql) and re.search(r"\b(open|show|go|switch|view|take me|into)\b", ql):
        return ack("Opening the 3D brain.", None, {"type": "nav", "to": "3d"})
    if re.search(r"\b2d\b", ql) and re.search(r"\b(open|show|go|switch|view|back)\b", ql):
        return ack("Back to the 2D graph.", None, {"type": "nav", "to": "2d"})
    if re.search(r"\b(fit|reset|re-?center|centre|zoom out)\b.*\b(view|graph|brain)\b", ql) or ql in ("fit", "reset view", "fit view"):
        return ack("Fitting the view.", None, {"type": "fit"})
    if re.search(r"\b(rescan|re-?scan|reload|refresh)\b", ql):
        return ack("Rescanning your vault.", None, {"type": "rescan"})
    if re.search(r"\b(brain gaps|missing (?:links|connections)|what.?s missing|find gaps|suggest links)\b", ql):
        return ack("Hunting for missing connections.", None, {"type": "gaps"})
    if re.search(r"\b(good morning|brief me|daily briefing|my briefing|what.?s new)\b", ql):
        return ack("Here is your briefing.", None, {"type": "briefing"})
    if re.search(r"\b(dark mode|lights off|go dark)\b", ql):
        return ack("Dark mode.", None, {"type": "theme", "mode": "dark"})
    if re.search(r"\b(light mode|lights on|go light)\b", ql):
        return ack("Light mode.", None, {"type": "theme", "mode": "light"})
    # ---- reminders
    m = re.search(r"remind me (?:to |that )?(.+?) in (\d+) ?(hours?|hrs?|h|minutes?|mins?|m)\b", ql)
    if m:
        what = q[m.start(1):m.end(1)].strip(); n = int(m.group(2)); unit = m.group(3); ms = n * 60000 * (60 if unit[0] == "h" else 1)
        return ack(f"Reminder set: {what} in {n} {unit}.", f"I will remind you to {what}.",
                   {"type": "reminder", "text": what, "delayMs": ms})
    m = re.search(r"remind me (?:to |that )?(.+?) at (\d{1,2})(?::(\d{2}))? ?(am|pm)?\b", ql)
    if m:
        what = q[m.start(1):m.end(1)].strip()
        return ack(f"Reminder set: {what} at {m.group(2)}{(':' + m.group(3)) if m.group(3) else ''} {m.group(4) or ''}".strip() + ".",
                   f"I will remind you to {what}.",
                   {"type": "reminder", "text": what, "at": {"h": int(m.group(2)), "m": int(m.group(3) or 0), "ap": m.group(4) or ""}})
    # ---- tasks
    if re.search(r"\b(my )?(tasks|to-?dos?|open items|action items)\b", ql) or re.search(r"what.?s on my (list|plate)", ql):
        items = scan_tasks(vault, graph)
        if not items:
            return ack("No open tasks in your notes. Add a line like '- [ ] call the client' and I will track it.")
        head = f"You have {len(items)} open task{'s' if len(items) != 1 else ''}: " + "; ".join(i["task"] for i in items[:5])
        return ack(head, head, {"type": "tasks", "items": items})
    return None

def jarvis_answer(graph, vault, question, cfg, model="", lang=""):
    q = (question or "").strip()
    ql = q.lower()
    memory = read_memory(vault)
    # intent: remember
    m = re.match(r"(?:remember(?: about me)?[,:]?\s*|note that\s*|keep in mind\s*)(.+)", ql)
    if m and len(q) > 12:
        fact = q[q.lower().find(m.group(1)):]
        add_memory(vault, fact)
        return {"answer": f"Noted. I will remember that {fact}", "spoken": f"Noted. I will remember that.", "sources": [], "focus": []}
    # intent: confirm a pending machine plan
    if re.fullmatch(r"(do it|confirm|yes,? do it|go ahead)\.?", ql) and getattr(State, "pending_plan", None):
        return run_pending_plan()
    # intent: control the machine by voice (only if allow_os is enabled)
    oc = os_command(cfg, q)
    if oc:
        return oc
    # intent: instant commands (tune, control the app, reminders, tasks)
    cmd = command_intent(q, cfg, graph, vault)
    if cmd:
        return cmd
    # intent: web research
    if re.search(r"\b(research|look up|search the (web|internet)|google|what'?s the weather)\b", ql):
        results = web_search(re.sub(r"^.*?(research|look up|search(?: the (?:web|internet))?|google)\s*", "", q, flags=re.I) or q)
        ctx = "\n".join(f"- {r['title']} ({r['url']})" for r in results) or "No results."
        ans = llm(cfg, model, [
            {"role": "system", "content": system_prompt(cfg, memory, lang) + " You just searched the live web. Summarise the answer in 2 or 3 sentences."},
            {"role": "user", "content": f"Web results for '{q}':\n{ctx}\n\nAnswer the user's request."}]) or "I could not reach the model."
        return {"answer": ans, "spoken": ans, "sources": [], "focus": [], "card": {"kind": "web", "title": "What I found", "items": results}}
    # default: RAG over notes
    hits = retrieve(graph, vault, q)
    key = cfg.get("ai_key") or cfg.get("openrouter_key") or env_key()
    if not key:
        if hits:
            top = hits[0]
            lines = [ln for ln in note_text(vault, top["id"]).splitlines()
                     if ln.strip() and not ln.lstrip().startswith("#") and not re.match(r"^\s*(#\w+\s*)+$", ln)]
            body = re.sub(r"\s+", " ", re.sub(r"[*`>\[\]]", "", " ".join(lines))).strip()
            snippet = " ".join(re.split(r"(?<=[.!?]) ", body)[:2])[:320]
            ans = f"From your note “{top['title']}”: {snippet}"
            if cfg.get("demo"):
                ans += "  ·  This is the live demo — download SYNAPSE and add your own key for full spoken answers."
        else:
            ans = "I could not find a note about that yet. Try Brain Gaps, or capture a new thought."
        return {"answer": ans, "spoken": ans, "sources": [{"id": h["id"], "title": h["title"]} for h in hits], "focus": [h["id"] for h in hits[:3]]}
    context = "\n\n".join(f"### {h['title']} ({h['id']})\n{note_text(vault, h['id'])[:1400]}" for h in hits) or "No notes matched."
    learn = (" If, from the user's question, you learned a durable fact about them (a preference, a project, "
             "a person, a goal), end your reply with one final line starting exactly with 'MEMORY:' and that single fact. "
             "Otherwise do not add that line.")
    ans = llm(cfg, model, [
        {"role": "system", "content": system_prompt(cfg, memory, lang) + " Cite the note titles you used." + learn},
        {"role": "user", "content": f"Notes:\n{context}\n\nQuestion: {q}"}]) or "I could not reach the model."
    learned = None
    mm = re.search(r"(?mi)^MEMORY:\s*(.+?)\s*$", ans)
    if mm:
        fact = mm.group(1).strip()
        ans = ans[:mm.start()].rstrip()
        if fact and fact.upper() != "NONE":
            add_memory(vault, fact); learned = fact
    return {"answer": ans, "spoken": ans, "sources": [{"id": h["id"], "title": h["title"]} for h in hits],
            "focus": [h["id"] for h in hits[:3]], "learned": learned}

# ----------------------------------------------------------------------------- discover + briefing
STOP = set("the a an and or of to in on for with is are was were be been this that it as at by from into out up down over under then than so if but not no yes do does did has have had will would can could should may might must your you our we they them their his her its about who what when where why how one two more most some any all each own new use used using make made get got need want like just into can't dont don't via per".split())

def _terms(n):
    words = re.findall(r"[a-z][a-z0-9]{2,}", (n["title"] + " " + n["excerpt"]).lower())
    return set(w for w in words if w not in STOP and len(w) > 2)

def suggest_links(graph, k=8):
    """Brain Gaps: notes that should be linked but are not, with a plain reason."""
    nodes = graph["nodes"]
    linked = set()
    for e in graph["edges"]:
        linked.add((e["source"], e["target"])); linked.add((e["target"], e["source"]))
    terms = {n["id"]: _terms(n) for n in nodes}
    tags = {n["id"]: set(n["tags"]) for n in nodes}
    pairs = []
    for i in range(len(nodes)):
        for j in range(i + 1, len(nodes)):
            a, b = nodes[i], nodes[j]
            if (a["id"], b["id"]) in linked:
                continue
            st = tags[a["id"]] & tags[b["id"]]
            sw = terms[a["id"]] & terms[b["id"]]
            score = 3 * len(st) + len(sw)
            if score >= 3:
                why = []
                if st: why.append("both tagged #" + ", #".join(sorted(st)[:2]))
                if sw: why.append("both mention " + ", ".join(sorted(sw)[:3]))
                pairs.append((score, {"source": a["id"], "target": b["id"],
                                      "a": a["title"], "b": b["title"], "why": " and ".join(why)}))
    pairs.sort(key=lambda x: -x[0])
    return [p for _, p in pairs[:k]]

def briefing(graph):
    """A spoken good-to-see-you summary of the whole brain."""
    nodes = graph["nodes"]
    n = len(nodes)
    hubs = [x for x in sorted(nodes, key=lambda x: -x.get("deg", 0)) if x.get("deg", 0) > 0][:3]
    orphans = [x for x in nodes if x.get("deg", 0) == 0]
    gaps = suggest_links(graph, 1)
    lines = [f"Good to see you. Your brain holds {n} notes and {graph['meta']['edges']} links across {len(graph['meta']['folders'])} areas."]
    if hubs:
        lines.append("Your busiest hubs are " + ", ".join(h["title"] for h in hubs) + ".")
    if orphans:
        w = "note is" if len(orphans) == 1 else "notes are"
        lines.append(f"{len(orphans)} {w} still floating with no links yet.")
    if gaps:
        g = gaps[0]
        lines.append(f"I also spotted a missing connection: {g['a']} and {g['b']} ({g['why']}).")
    text = " ".join(lines)
    return {"answer": text, "spoken": text,
            "sources": [{"id": h["id"], "title": h["title"]} for h in hubs],
            "focus": [h["id"] for h in hubs]}

def capture_note(graph, vault, cfg, text):
    """Zero-friction capture: a raw thought becomes a filed, tagged, linked note."""
    text = (text or "").strip()
    if not text:
        return {"ok": False}
    titles = [n["title"] for n in graph["nodes"]]
    folders = graph["meta"]["folders"]
    key = cfg.get("ai_key") or cfg.get("openrouter_key") or env_key()
    title, folder, tags, body, links = None, None, [], text, []
    if key:
        prompt = (f"Existing folders: {folders}\nExisting note titles: {titles[:60]}\n"
                  f"User thought: {text}\n\nFile this thought. Return ONLY JSON with keys: "
                  f"title (short), folder (pick an existing folder or a sensible new one), "
                  f"tags (1 to 3 lowercase words), links (existing note titles it connects to), "
                  f"body (the thought as a short clean markdown note).")
        raw = llm(cfg, "", [{"role": "system", "content": "You file notes into a personal knowledge base. Output only JSON."},
                            {"role": "user", "content": prompt}]) or ""
        try:
            d = json.loads(raw[raw.find("{"):raw.rfind("}") + 1])
            title = d.get("title"); folder = d.get("folder"); tags = d.get("tags", []) or []
            body = d.get("body", text) or text; links = d.get("links", []) or []
        except Exception:
            pass
    if not title:
        title = re.sub(r"\s+", " ", text)[:48].strip() or "Note"
    folder = folder or "Inbox"
    safe = re.sub(r"[^\w\- ]", "", title).strip()[:60] or "note"
    fdir = os.path.join(vault, folder)
    try:
        os.makedirs(fdir, exist_ok=True)
    except Exception:
        fdir = vault
    path = os.path.join(fdir, safe + ".md"); i = 2
    while os.path.exists(path):
        path = os.path.join(fdir, f"{safe} {i}.md"); i += 1
    linktext = ("\n\n" + " ".join(f"[[{l}]]" for l in links if l in titles)) if links else ""
    tagtext = ("\n\n" + " ".join("#" + re.sub(r"[^\w/-]", "", t) for t in tags)) if tags else ""
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n{body}{linktext}{tagtext}\n")
    rel = os.path.relpath(path, vault)
    return {"ok": True, "id": rel, "title": title, "folder": os.path.basename(fdir)}

def add_link(vault, src_id, target_title, graph):
    """Auto tidy: write a missing [[link]] into the source note."""
    if src_id not in {n["id"] for n in graph["nodes"]}:
        return False
    p = os.path.join(vault, src_id)
    if not os.path.exists(p):
        return False
    txt = read(p)
    if f"[[{target_title}]]" in txt:
        return True
    try:
        with open(p, "a", encoding="utf-8") as f:
            f.write(f"\n\n[[{target_title}]]\n")
        return True
    except Exception:
        return False

def rediscover(graph):
    """Resurface an older note that connects to what you have been working on lately."""
    nodes = graph["nodes"]
    if len(nodes) < 3:
        return {"answer": "Your brain is still small. Add a few more notes and I will start resurfacing.", "spoken": "Add a few more notes first.", "focus": []}
    recent = sorted(nodes, key=lambda n: -(n.get("mtime", 0)))[:3]
    recent_ids = {n["id"] for n in recent}
    adj = {}
    for e in graph["edges"]:
        adj.setdefault(e["source"], set()).add(e["target"]); adj.setdefault(e["target"], set()).add(e["source"])
    cands = [n for n in nodes if n["id"] not in recent_ids and (adj.get(n["id"], set()) & recent_ids)]
    if not cands:
        cands = [n for n in nodes if n["id"] not in recent_ids]
    pick = min(cands, key=lambda n: n.get("mtime", 0))
    ans = f"You might revisit {pick['title']}. It ties into what you have been working on, but you have not touched it in a while."
    return {"answer": ans, "spoken": ans, "sources": [{"id": pick["id"], "title": pick["title"]}], "focus": [pick["id"]]}

def brain_tour(graph):
    """A narrated, cinematic tour of the user's own brain."""
    nodes = graph["nodes"]; n = len(nodes)
    hubs = [x for x in sorted(nodes, key=lambda x: -x.get("deg", 0)) if x.get("deg", 0) > 0]
    orphans = [x for x in nodes if x.get("deg", 0) == 0 and not x["id"].endswith("jarvis-memory.md")]
    recent = sorted(nodes, key=lambda x: -(x.get("mtime", 0)))[:1]
    gaps = suggest_links(graph, 1)
    steps = [{"focus": [], "say": f"Welcome to your brain. {n} notes, {graph['meta']['edges']} links, across {len(graph['meta']['folders'])} areas."}]
    if hubs:
        steps.append({"focus": [hubs[0]["id"]], "say": f"This is your busiest hub, {hubs[0]['title']}. A lot connects through it."})
    if recent:
        steps.append({"focus": [recent[0]["id"]], "say": f"Your most recent thought is {recent[0]['title']}."})
    if orphans:
        verb = "floats" if len(orphans) == 1 else "float"
        steps.append({"focus": [orphans[0]["id"]], "say": f"{len(orphans)} note{'s' if len(orphans) != 1 else ''} {verb} with no links yet, like {orphans[0]['title']}. Worth connecting."})
    if gaps:
        steps.append({"focus": [gaps[0]["source"], gaps[0]["target"]], "say": f"And here is a link you are missing: {gaps[0]['a']} and {gaps[0]['b']}."})
    steps.append({"focus": [x["id"] for x in hubs[:3]], "say": "That is your brain. Ask me anything, or just explore."})
    return {"steps": steps}

def brain_stats(graph):
    """Personal analytics: size, growth, busiest areas, hubs."""
    nodes = graph["nodes"]
    deg = sorted(nodes, key=lambda x: -x.get("deg", 0))
    orphans = [x for x in nodes if x.get("deg", 0) == 0]
    by_folder = {}
    for x in nodes:
        by_folder[x["folder"]] = by_folder.get(x["folder"], 0) + 1
    words = sum(x.get("words", 0) for x in nodes)
    mts = sorted(x.get("mtime", 0) for x in nodes if x.get("mtime"))
    growth = []
    if len(mts) >= 2 and mts[-1] > mts[0]:
        B = 8; lo, hi = mts[0], mts[-1]; span = (hi - lo) or 1; counts = [0] * B
        for m in mts:
            counts[min(B - 1, int((m - lo) / span * B))] += 1
        cum = 0
        for c in counts:
            cum += c; growth.append(cum)
    else:
        growth = [len(mts)]
    return {"notes": len(nodes), "links": graph["meta"]["edges"], "words": words,
            "orphans": len(orphans), "folders": by_folder,
            "topHubs": [{"title": x["title"], "deg": x.get("deg", 0)} for x in deg[:5] if x.get("deg", 0) > 0],
            "growth": growth}

def today_focus(graph, vault, cfg):
    """A personalised focus for today, read from the user's own brain."""
    nodes = graph["nodes"]
    tasks = scan_tasks(vault, graph, 6)
    recent = sorted(nodes, key=lambda n: -(n.get("mtime", 0)))[:3]
    linked = [n for n in nodes if n.get("deg", 0) > 0]
    stale = sorted(linked, key=lambda n: n.get("mtime", 0))[:1]
    gaps = suggest_links(graph, 1)
    facts = []
    if tasks: facts.append("Open tasks: " + "; ".join(t["task"] for t in tasks[:4]))
    if recent: facts.append("Recently touched: " + ", ".join(n["title"] for n in recent))
    if stale: facts.append("Untouched for a while: " + stale[0]["title"])
    if gaps: facts.append(f"A missing link: {gaps[0]['a']} and {gaps[0]['b']}")
    key = cfg.get("ai_key") or cfg.get("openrouter_key") or env_key()
    if key and facts:
        ans = llm(cfg, "", [
            {"role": "system", "content": system_prompt(cfg, read_memory(vault)) + " Give a short, motivating focus for today as two or three concrete actions, spoken aloud."},
            {"role": "user", "content": "My brain right now:\n" + "\n".join(facts) + "\n\nWhat should I focus on today?"}]) or ""
    else:
        bits = []
        if tasks: bits.append("start with " + tasks[0]["task"])
        if stale: bits.append("revisit " + stale[0]["title"])
        if gaps: bits.append(f"connect {gaps[0]['a']} and {gaps[0]['b']}")
        ans = "Today: " + ("; ".join(bits) + "." if bits else "add your first note and I will build your focus.")
    focus_ids = [t["id"] for t in tasks[:2]] + [n["id"] for n in recent[:1]]
    return {"answer": ans, "spoken": ans,
            "sources": [{"id": t["id"], "title": t["title"]} for t in tasks[:3]], "focus": focus_ids}

def _run(cmd):
    try:
        subprocess.run(cmd, shell=True, timeout=12); return True
    except Exception:
        return False

def os_command(cfg, q):
    """Voice control of the machine. Off unless allow_os is true in config (never on a public demo)."""
    if not cfg.get("allow_os"):
        return None
    ql = q.lower().strip(); sysn = platform.system()

    def ack(a, spoken=None, **extra):
        d = {"answer": a, "spoken": spoken or a, "sources": [], "focus": []}; d.update(extra); return d

    m = re.search(r"(?:set )?volume (?:to |at )?(\d{1,3})", ql)
    if m:
        v = max(0, min(100, int(m.group(1))))
        if sysn == "Darwin": _run(f"osascript -e 'set volume output volume {v}'")
        elif sysn == "Linux": _run(f"amixer -q sset Master {v}% || pactl set-sink-volume @DEFAULT_SINK@ {v}%")
        return ack(f"Volume set to {v}.")
    if re.search(r"\b(mute|silence)\b", ql):
        if sysn == "Darwin": _run("osascript -e 'set volume output muted true'")
        elif sysn == "Linux": _run("amixer -q sset Master mute")
        return ack("Muted.")
    if "dark mode" in ql or "evening mode" in ql:
        if sysn == "Darwin": _run("osascript -e 'tell application \"System Events\" to tell appearance preferences to set dark mode to true'")
        return ack("Dark mode on.")
    if "light mode" in ql or "day mode" in ql:
        if sysn == "Darwin": _run("osascript -e 'tell application \"System Events\" to tell appearance preferences to set dark mode to false'")
        return ack("Light mode on.")
    m = re.search(r"\bopen (?:the )?(\w[\w .-]{1,30})", ql)
    if m and "note" not in ql and "brain" not in ql:
        app = q[m.start(1):m.end(1)].strip().rstrip(".")
        if sysn == "Darwin": _run(f"open -a \"{app}\"")
        elif sysn == "Linux": _run(f"(xdg-open \"{app}\" || setsid \"{app.lower()}\") >/dev/null 2>&1 &")
        return ack(f"Opening {app}.")
    m = re.search(r"find (?:my |the )?(.+?)(?: pdf| file| document)?\s*$", ql)
    if m and "find" in ql:
        term = m.group(1).strip(); home = os.path.expanduser("~"); hits = []
        for root, dirs, files in os.walk(home):
            dirs[:] = [d for d in dirs if not d.startswith(".")]
            for f in files:
                if term in f.lower():
                    hits.append(os.path.join(root, f))
            if len(hits) >= 6: break
        if hits:
            return ack("Found: " + "; ".join(os.path.basename(h) for h in hits[:6]), f"I found {len(hits)} matching {term}.",
                       card={"kind": "files", "title": "Found on your machine", "items": [{"title": os.path.basename(h), "url": h} for h in hits[:6]]})
        return ack(f"I could not find anything matching {term}.")
    if re.search(r"clean(?:\s*up)?\s+(?:my )?downloads", ql):
        dl = os.path.expanduser("~/Downloads"); files = [f for f in glob.glob(dl + "/*") if os.path.isfile(f)]
        State.pending_plan = {"type": "clean_downloads", "files": files}
        return ack(f"Plan: move {len(files)} loose files from Downloads into a dated Archive folder. Say 'do it' to confirm.",
                   f"I can tidy {len(files)} files from Downloads into an archive. Say do it to confirm.", plan=True)
    return None

def run_pending_plan():
    plan = getattr(State, "pending_plan", None)
    if not plan:
        return {"answer": "Nothing to confirm.", "spoken": "Nothing to confirm."}
    State.pending_plan = None
    if plan["type"] == "clean_downloads":
        dl = os.path.expanduser("~/Downloads"); dest = os.path.join(dl, "Archive"); os.makedirs(dest, exist_ok=True); n = 0
        for f in plan["files"]:
            try:
                if os.path.isfile(f): os.rename(f, os.path.join(dest, os.path.basename(f))); n += 1
            except Exception:
                pass
        return {"answer": f"Done. Archived {n} files into Downloads/Archive.", "spoken": f"Done. Archived {n} files."}
    return {"answer": "Done.", "spoken": "Done."}

def hue_pulse(cfg):
    """Pulse the room lights (Philips Hue) once. Needs hue_bridge + hue_user in config."""
    bridge, user = cfg.get("hue_bridge"), cfg.get("hue_user")
    if not bridge or not user:
        return {"ok": False}
    lights = cfg.get("hue_lights") or []
    try:
        if not lights:
            data = json.loads(urllib.request.urlopen(f"http://{bridge}/api/{user}/lights", timeout=4).read())
            lights = list(data.keys())
        for lid in lights:
            body = json.dumps({"alert": "select"}).encode()
            req = urllib.request.Request(f"http://{bridge}/api/{user}/lights/{lid}/state", data=body, method="PUT")
            urllib.request.urlopen(req, timeout=4)
        return {"ok": True, "lights": len(lights)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120]}

def realtime_token(cfg):
    """Mint an ephemeral OpenAI Realtime session token so the browser can open a live voice call."""
    key = cfg.get("ai_key") or env_key()
    if not key:
        return {"error": "no key"}
    try:
        body = json.dumps({"model": "gpt-4o-realtime-preview", "voice": "verse"}).encode()
        req = urllib.request.Request("https://api.openai.com/v1/realtime/sessions", data=body,
            headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
        return json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception as e:
        return {"error": str(e)[:140]}

# ----------------------------------------------------------------------------- server
class State:
    pending_plan = None
    graph = {"meta": {}, "nodes": [], "edges": []}
    config = {}
    vault = "."
    vaults = ["."]
    vidx = 0

def make_handler():
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def _send(self, code, body, ctype="application/json"):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.end_headers()
            self.wfile.write(body if isinstance(body, bytes) else body.encode())
        def do_GET(self):
            path = self.path.split("?")[0]
            if path in ("/", "/index.html"): return self._file("index.html")
            if path in ("/3d.html", "/brain3d.html"): return self._file("brain3d.html")
            if path == "/graph.json":
                return self._send(200, json.dumps(State.graph))
            if path == "/config.json":
                safe = {k: State.config.get(k) for k in ("name", "accent", "accent2", "logo", "persona", "humor", "voice")}
                safe["jarvis"] = bool(State.config.get("ai_key") or State.config.get("openrouter_key") or env_key())
                safe["strict"] = bool(State.config.get("strict"))
                safe["realtime"] = bool(State.config.get("realtime") and safe["jarvis"])
                safe["allow_os"] = bool(State.config.get("allow_os"))
                safe["hue"] = bool(State.config.get("hue_bridge") and State.config.get("hue_user"))
                safe["demo"] = bool(State.config.get("demo"))
                return self._send(200, json.dumps(safe))
            if path == "/rescan":
                State.graph = scan(State.vault)
                return self._send(200, json.dumps({"ok": True, "count": State.graph["meta"]["count"]}))
            if path == "/api/vaults":
                return self._send(200, json.dumps({"current": State.vidx,
                    "vaults": [{"idx": i, "name": os.path.basename(v.rstrip("/\\")) or v} for i, v in enumerate(State.vaults)]}))
            if path == "/api/suggest":
                return self._send(200, json.dumps({"pairs": suggest_links(State.graph)}))
            if path == "/api/briefing":
                return self._send(200, json.dumps(briefing(State.graph)))
            if path == "/api/today":
                return self._send(200, json.dumps(today_focus(State.graph, State.vault, State.config)))
            if path == "/api/rediscover":
                return self._send(200, json.dumps(rediscover(State.graph)))
            if path == "/api/tour":
                return self._send(200, json.dumps(brain_tour(State.graph)))
            if path == "/api/hue":
                return self._send(200, json.dumps(hue_pulse(State.config)))
            if path == "/api/realtime-token":
                return self._send(200, json.dumps(realtime_token(State.config)))
            if path == "/api/stats":
                return self._send(200, json.dumps(brain_stats(State.graph)))
            if path.startswith("/note"):
                nid = urllib.parse.unquote(self.path.split("id=", 1)[1]) if "id=" in self.path else ""
                if nid not in {n["id"] for n in State.graph["nodes"]}:   # no path traversal: known notes only
                    return self._send(404, json.dumps({"error": "unknown note"}))
                return self._send(200, json.dumps({"id": nid, "text": note_text(State.vault, nid)}))
            # static web asset (guard against path traversal)
            fn = path.lstrip("/")
            if fn:
                full = os.path.realpath(os.path.join(WEB, fn))
                if full.startswith(os.path.realpath(WEB) + os.sep) and os.path.isfile(full):
                    return self._file(fn)
            return self._send(404, json.dumps({"error": "not found"}))
        def do_POST(self):
            path = self.path.split("?")[0]
            ln = int(self.headers.get("Content-Length", 0))
            try:
                data = json.loads(self.rfile.read(ln) or b"{}")
            except Exception:
                data = {}
            if path == "/api/ask":
                out = jarvis_answer(State.graph, State.vault, data.get("q", ""), State.config, data.get("model", ""), data.get("lang", ""))
                return self._send(200, json.dumps(out))
            if path == "/api/switch":
                idx = int(data.get("idx", 0))
                if 0 <= idx < len(State.vaults):
                    State.vidx = idx; State.vault = State.vaults[idx]
                    State.config = load_config(State.vault); State.graph = scan(State.vault)
                    return self._send(200, json.dumps({"ok": True, "name": os.path.basename(State.vault), "count": State.graph["meta"]["count"]}))
                return self._send(200, json.dumps({"ok": False}))
            if path == "/api/vision":
                return self._send(200, json.dumps(vision_answer(State.config, data.get("image", ""), data.get("q", ""))))
            if path == "/api/remember":
                add_memory(State.vault, data.get("text", ""))
                return self._send(200, json.dumps({"ok": True}))
            if path == "/api/capture":
                out = capture_note(State.graph, State.vault, State.config, data.get("text", ""))
                if out.get("ok"):
                    State.graph = scan(State.vault)   # so the new note shows up immediately
                return self._send(200, json.dumps(out))
            if path == "/api/link":
                ok = add_link(State.vault, data.get("source", ""), data.get("target", ""), State.graph)
                if ok:
                    State.graph = scan(State.vault)
                return self._send(200, json.dumps({"ok": ok, "count": State.graph["meta"]["count"], "edges": State.graph["meta"]["edges"]}))
            if path == "/api/set":  # runtime tweaks + connect a key (persisted to config.json)
                for k in ("persona", "humor", "model", "voice", "provider", "name", "accent", "accent2", "ai_key", "openrouter_key"):
                    if k in data and data[k] != "":
                        State.config[k] = data[k]
                saved = save_config(State.vault, State.config)
                jarvis = bool(State.config.get("ai_key") or State.config.get("openrouter_key") or env_key())
                return self._send(200, json.dumps({"ok": True, "saved": saved, "jarvis": jarvis,
                    "config": {k: State.config.get(k) for k in ("persona", "humor", "model", "voice")}}))
            return self._send(404, json.dumps({"error": "not found"}))
        def _file(self, name):
            p = os.path.join(WEB, name)
            if not os.path.exists(p): return self._send(404, b"missing")
            ctype = mimetypes.guess_type(p)[0] or "text/html"
            with open(p, "rb") as f:
                self._send(200, f.read(), ctype)
    return H

def gen_key():
    import random
    AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    p = "".join(random.choice(AL) for _ in range(5))
    s = sum((AL.index(c) + 1) * (i + 2) for i, c in enumerate(p))
    return "LAMARCA-" + p + AL[s % len(AL)]

def main():
    import urllib.parse
    args = sys.argv[1:]
    if "--genkey" in args:
        n = 1
        for a in args:
            if a.isdigit(): n = min(200, int(a))
        for _ in range(n):
            print(gen_key())
        return
    vaults = []
    port = 4711
    do_open = True
    demo_mode = False
    i = 0
    while i < len(args):
        if args[i] == "--port": port = int(args[i + 1]); i += 2
        elif args[i] == "--no-open": do_open = False; i += 1
        elif args[i] == "--demo": demo_mode = True; i += 1
        else: vaults.append(args[i]); i += 1
    if not vaults:
        sample = os.path.join(ROOT, "sample")
        if getattr(sys, "frozen", False) and os.path.isdir(sample):
            vaults = [sample]   # first-run demo when double-clicked with no folder
        else:
            vaults = ["."]
    State.vaults = [os.path.abspath(v) for v in vaults]
    State.vidx = 0
    vault = State.vault = State.vaults[0]
    State.config = load_config(vault)
    if demo_mode:
        State.config["demo"] = True
        State.config["allow_os"] = False  # never let a public demo touch the host
        State.config["ai_key"] = ""; State.config["openrouter_key"] = ""
        os.environ["SYNAPSE_DEMO"] = "1"   # env_key() returns None -> extractive JARVIS only
    State.graph = scan(vault)
    print(f"  SYNAPSE  ·  {State.config.get('name')}")
    print(f"  vault    : {os.path.abspath(vault)}")
    print(f"  notes    : {State.graph['meta']['count']}   links: {State.graph['meta']['edges']}")
    Handler = make_handler()
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    # auto-pick a free port
    while True:
        try:
            httpd = socketserver.ThreadingTCPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            port += 1
    url = f"http://localhost:{port}/"
    print(f"  open     : {url}   (3D at {url}3d.html)")
    if do_open:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n  bye.")

if __name__ == "__main__":
    main()
