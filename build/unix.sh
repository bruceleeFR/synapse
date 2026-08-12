#!/usr/bin/env bash
# Build SYNAPSE for macOS or Linux. Run from the repo root: bash build/unix.sh
set -e
cd "$(dirname "$0")/.."
python3 -m pip install --quiet pyinstaller
python3 -m PyInstaller synapse.spec
echo
echo "Done. Your app is in dist/"
ls -la dist/
