# PyInstaller spec — builds SYNAPSE as a single self-contained app.
# Run from the repo root:  pyinstaller synapse.spec
# Produces dist/SYNAPSE (or SYNAPSE.exe on Windows, SYNAPSE.app on macOS).
import sys

datas = [('web', 'web'), ('sample-vault', 'sample')]

a = Analysis(
    ['synapse.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=['http.server', 'socketserver'],
    hookspath=[],
    runtime_hooks=[],
    excludes=['tkinter', 'numpy', 'PIL'],
    noarchive=False,
)
pyz = PYZ(a.pure, a.zipped_data)

exe = EXE(
    pyz, a.scripts, a.binaries, a.zipfiles, a.datas, [],
    name='SYNAPSE',
    debug=False, strip=False, upx=True, console=True,
)

if sys.platform == 'darwin':
    app = BUNDLE(exe, name='SYNAPSE.app', icon=None, bundle_identifier='ai.lamarca.synapse')
