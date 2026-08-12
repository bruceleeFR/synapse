# SYNAPSE

**Your notes, alive.** Point SYNAPSE at a folder of markdown notes and it turns them into a living brain you can fly through, in 2D and 3D, with a built in JARVIS that answers from your own notes.

Every note is a node. Every `[[link]]` is a synapse. Nothing to configure, no database, and nothing leaves your machine.

![SYNAPSE](docs/hero.png)

## Why people use it

- **See the shape of what you know.** Your notes stop being a flat list and become a map you can actually read.
- **Find what you forgot to connect.** Brain Gaps surfaces the links your notes are missing and tells you why.
- **Ask your own brain.** JARVIS answers from your notes, flies the graph to the source, and reads it back to you.
- **Own it.** Pure local. One Python file, no dependencies, no cloud.

## Quick start

You need Python 3. That is the only requirement.

```bash
python3 synapse.py /path/to/your/notes
```

Your browser opens on the graph. An Obsidian vault works as is, since it is already markdown with `[[wikilinks]]`.

No path given runs a small demo vault so you can look around first.

## What it does

- **2D brain**: force directed graph, search, folder filters, backlinks, minimap.
- **3D brain**: a real 3D galaxy of your notes with cinematic bloom. Click any node to read it.
- **JARVIS**: ask by text or voice, or start a live call. It answers from your notes and flies to the source.
- **Brain Gaps**: suggested links your notes are missing, drawn as dashed synapses with the reason.
- **Command palette**: press `Cmd/Ctrl + K` for every action and to jump to any note.
- **More**: daily briefing, tasks from your checkboxes, reminders, screen vision, path between two notes, focus mode, cluster by theme, export the brain as a PNG, multi vault switching, light and dark, full white label.

## Turn on JARVIS

The graph and every effect work with no key. To let JARVIS answer, open **Tune JARVIS** in the app and paste an OpenAI key (or an OpenRouter key for Grok, Gemini and others). The key is saved locally in your vault `config.json` and never leaves your machine.

## Make it a desktop app

Build a single double click app with no Python needed on the target machine.

```bash
bash build/unix.sh        # macOS or Linux
build\windows.bat         # Windows
```

Or push the repo and let GitHub Actions build Windows, macOS and Linux for you. See `build/README.md`.

## White label it

Drop a `config.json` in your notes folder:

```json
{ "name": "MY BRAIN", "accent": "#5b8bff", "accent2": "#8f6bff" }
```

## Privacy

SYNAPSE reads your files, builds the graph in memory and serves it to your own browser on localhost. There is no telemetry and no account. When you add an AI key, only the notes relevant to your question are sent to that provider, and only when you ask.

## License

MIT.
