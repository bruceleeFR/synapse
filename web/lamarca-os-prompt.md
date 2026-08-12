# LAMARCA OS — the build prompt

Paste everything below into your AI (Claude or GPT) and let it build. It produces a single, self contained HTML file: a full screen spatial computing interface you drive with your voice and your hands. No build step, no server, no paid key to try it.

House of Lamarca. Build your own. Then make it yours.

---

## THE PROMPT (copy from here)

You are a senior creative engineer building an Awwwards level spatial computing interface called **LAMARCA OS**. Deliver it as **one single HTML file** that runs by double clicking it. No build tools, no frameworks to install, no backend required. Vanilla JavaScript and **Three.js only**. It must run offline and on both desktop and phone.

### The idea
A full screen 3D world. The user stands in front of a gentle arc of floating glass HUD panels, each one a living module (Weather, News, Markets, AI, System, Calendar, Music, Sports, Social, Projects). They rotate the arc, open a panel, and talk to it. It feels like stepping inside an operating system, not clicking one.

### Visual design (this is what makes it)
- Dark space, deep navy to black, with a faint particle field and a holographic **grid floor** in perspective. Subtle exponential fog for depth.
- Panels are **glass, each tinted in its own color** (Markets green, Weather cyan, Projects amber, AI violet, Social orange). Thin glowing outline, **L shaped corner brackets** on all four corners, faint internal scanlines, a soft top gloss.
- On every panel, draw a **mini dashboard onto its canvas texture**: a small id (M 01 to M 10), a status line, the module name in a tall bold face, a subtitle, a **telemetry sparkline**, two metric readouts, and where relevant a small warning badge like SETUP REQUIRED in amber.
- Around the arc: a HUD in the corners. Top left a system panel (name, status, fps, tracking mode). Top right a live clock and date. A scrolling system log bottom left. Corner brackets framing the whole screen. A holographic response area for AI answers. A command bar at the bottom center: a mic button, a text input that says "Ask LAMARCA", a hand toggle, a mute toggle.
- A **cinematic boot sequence** on load: a spinning logo, the words LAMARCA OS, a progress bar and steps that stream in, then it fades and the cards **assemble into place** with a stagger.
- Ambient **WebAudio** pad (a few detuned oscillators through a lowpass, very quiet) plus soft UI blips on hover, select, wake. A mute button.
- Mouse **parallax**, an energy pulse ring when a panel is selected, a light vignette. Keep motion tasteful, never busy.

### Modules with real data, no key
- **Weather**: fetch the **Open Meteo** API (open-meteo.com, no key, CORS open). Use geolocation with a city fallback. Show the temperature, condition, wind, and a small temperature sparkline for the next hours.
- **News**: fetch the **Hacker News** API (hacker-news.firebaseio.com, no key). Show the top 5 or 6 headlines as clickable links.
- **AI**: this panel is the point. A command bar where the user asks anything, by text or voice, and it answers out loud. Wire it to a single `POST /api/ask` (or directly to the OpenAI API with the user's own key, read from `localStorage` and sent per request, never hardcoded). Stream the answer into the holographic text and speak it with the Web Speech API. If you have a notes graph, show the user's real notes count, links, and top hubs, each one clickable.
- The rest (Markets, System, Calendar, Music, Sports, Projects, Social) render a rich panel with realistic demo numbers and a canvas chart, so the interface feels alive even before real data is wired.
- When a module opens, **the whole room reacts**: rain particles and cooler fog for Weather, deep space for System, warm light for Projects. Lerp the fog color, density and lights toward the target each frame.

### Voice
Use `webkitSpeechRecognition` for input and `speechSynthesis` for output. A wake word ("LAMARCA") and simple commands ("open weather", "close", "home"). Set the utterance and recognition **language to match the interface language**, and pick a matching voice.

### Hand tracking (this is the wow)
Load **MediaPipe Tasks Vision** by dynamic `import()` from a CDN, only when the user taps the hand button (so it never blocks first paint). Request the front camera. Run the hand landmarker in VIDEO mode, GPU delegate with a CPU fallback, `numHands: 2`, detection confidence around 0.4 so it catches hands easily.
- On the small camera preview at the corner, **draw the hand skeleton**: all 21 landmarks and their connections, glowing, with brighter fingertips. Show a "1 hand / 2 hands / no hand" badge and glow the preview green when a hand is seen.
- Put a **glowing cursor on screen** at the smoothed index fingertip (mirror the x so it feels like a mirror). Smooth every value with an exponential moving average so nothing jitters.
- Gestures: **open palm** wakes it and freezes, **swipe** rotates the arc, **pinch** selects the panel under the cursor, **fist** goes home, **two hands** change distance to **zoom**. Add short cooldowns so a gesture never double fires.
- It must feel intuitive and precise. The cursor plus a hover highlight tells the user exactly what a pinch will select.

### Interaction and layout
- Drag to rotate the arc, scroll to zoom, click a panel to open it, click again or Escape to collapse.
- The front few panels must be **readable at once** in a clean row, with the far ones faded so the scene never looks cluttered. On a **phone in portrait**, widen the field of view, pull the camera back, shrink the cards and reduce the camera drift so the front panel stays centered and never spills off screen. Everything responsive.
- Offer a one tap link to switch to a companion view (a second brain, a dashboard, whatever the user already has) and back. The two should feel complementary.

### Engineering rules
- One file. Three.js is the only dependency; vendor it or load it from a CDN. No bundler.
- Guard everything: if there is no camera, fall back to mouse and never throw. If a fetch fails, show a graceful message. Watch for automatic semicolon insertion bugs (never start a line with `[` or `(` after a statement with no semicolon).
- Clean, readable code. Comment the non obvious parts. Respect `prefers-reduced-motion`.

### The bar
Ship the top of the top. Cinematic, precise, alive. When someone opens it for the first time, it should feel like the future arrived on their own laptop.

Now build LAMARCA OS as a single HTML file, complete and runnable.

---

## After it builds
- Open the file. Tap the mic and say a command. Tap the hand button, allow the camera, and move your hand.
- Wire the **AI** to your own notes or your own key so it answers from your world.
- Want the finished reference and the second brain it plugs into? That is **SYNAPSE**. See the live demo, then download it and point it at your own notes.

Built in House of Lamarca.
