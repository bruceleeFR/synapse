---
name: synapse
description: Turn any folder of markdown notes into a living 2D and 3D second brain, served locally in the browser, with a JARVIS panel that answers questions from the notes. Trigger when the user types /synapse, or asks to visualise, map, or explore their notes, vault, or second brain.
---

# SYNAPSE — your second brain as a living graph

When invoked, build and open the user's second brain from a folder of markdown notes.

## Run it (one command)
From the folder that holds the notes (an Obsidian vault, a project folder, anything with `.md` files), run:

    python3 "$SKILL_DIR/synapse.py" .

It scans the `.md` files, reads the `[[wikilinks]]`, tags and folders, builds the graph, starts a local server on a free port, and opens the browser. The 2D brain is the daily driver (offline, minimap, search). The 3D brain is the show, at `/3d.html`. JARVIS (bottom bar) answers from the notes when an `OPENAI_API_KEY` is set.

## No notes yet
Offer to set up a starter vault: ask the user what their business or project is, create a few folders and linked markdown notes (use `[[wikilinks]]` between them and `#tags`), then run the command above.

## White-label (to brand it or resell it)
Drop a `config.json` next to the notes (or in the skill folder):

    { "name": "YOUR BRAND — BRAIN", "accent": "#5b8bff", "accent2": "#8f6bff", "logo": "/path/to/logo.png" }

Re-run and it is branded.

## Notes
- Pure Python 3, no dependencies, no database. Three.js is vendored for offline 3D.
- More `[[links]]` between notes means a denser, more useful graph.
- After adding notes, click Rescan in the bar (or re-run) to refresh.
