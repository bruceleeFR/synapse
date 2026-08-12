# SYNAPSE desktop builds

One command turns SYNAPSE into a double click app. No Python needed on the target machine.
The app bundles the web UI and a demo vault, starts the local server and opens your browser.

## What you get
- Windows: `SYNAPSE.exe`
- macOS: `SYNAPSE.app` (zipped) or a `.dmg`
- Linux: `synapse` binary

## Build on the same OS you target
PyInstaller does not cross compile. Build the Windows exe on Windows, the Mac app on a Mac.
Both scripts are one line and use the shared spec.

Windows (PowerShell or cmd):

    build\windows.bat

macOS / Linux:

    bash build/unix.sh

Output lands in `dist/`.

## Build both automatically with GitHub Actions
Push the repo. The workflow in `.github/workflows/build-desktop.yml` builds Windows, macOS and
Linux in parallel and attaches `SYNAPSE.exe`, `SYNAPSE-mac.zip` and `synapse-linux` to the run.
Download them from the Actions tab. No local Windows or Mac needed.

## Point it at your own notes
Double clicking runs the bundled demo vault. To read your own folder, run it with a path:

    SYNAPSE.exe "C:\Users\me\Obsidian\MyVault"
    ./SYNAPSE.app/Contents/MacOS/SYNAPSE ~/Notes
    ./synapse ~/Notes

An Obsidian vault works as is: it is already markdown with [[wikilinks]].
