"""One same-material/lighting before image from the exact historical runtime GLB.
Run from repo root; pass -- /path/to/cb6238.glb if the local QA archive moved.
"""
import sys,json
from pathlib import Path
sys.path.insert(0,str(Path.cwd()/'blender'))
import finish_kestrel_shopkeeper as h
path=Path(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else Path.cwd()/'test-results/shopkeeper-evidence/preflight/uncorrected/kestrel-shopkeeper.glb'
assert h.identity(path)['sha256']=='cb6238203ea14e55789ece92d912af04a087bf546960ab540e8597b366fb1e97'
arm,mesh=h.load_scene(path)
h.studio(arm,mesh,[],preview=True,only=['front-oblique'],prefix='before-resting-')
