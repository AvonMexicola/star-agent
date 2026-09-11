"""CPU-only complete source build. Requires Blender and Python with Pillow.
No browser, rendering, network request or shared application mutation.
"""
from pathlib import Path
import os, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
def run(args,**kwargs):subprocess.run(args,cwd=ROOT,check=True,**kwargs)
if __name__=='__main__':
    run([sys.executable,'blender/gannet_textures.py'])
    run([os.environ.get('BLENDER_PATH','blender'),'--background','--factory-startup','-noaudio','--python-exit-code','1','--python','blender/build_gannet.py'],env={**os.environ,'ALSOFT_DRIVERS':'null'})
    run([sys.executable,'blender/gannet_pack.py'])
