#!/usr/bin/env python3
"""Drive the running Unreal editor from the shell through Python remote execution.

Needs the editor open with the Star Agent project and Project Settings > Plugins >
Python > Remote Execution enabled (DefaultEngine.ini sets it). Uses the engine's
own client module; nothing is installed.

  ue-remote.py ping                       # list reachable editor nodes
  ue-remote.py py  "print(unreal.SystemLibrary.get_engine_version())"
  ue-remote.py play | stop                # start / end Play In Editor
  ue-remote.py exec "stat unit"           # console command in the PIE world
  ue-remote.py goto LAT LON ALT_M         # fly pawn to latitude/longitude (browser frame), altitude above terrain
  ue-remote.py look YAW PITCH             # degrees; yaw around local up from north
  ue-remote.py wait [SECONDS]             # wait until the planet reports no pending patches (default 30 s cap)
  ue-remote.py shot NAME [WxH]            # HighResShot, prints the PNG path
  ue-remote.py log [N]                    # last N lines of the editor log mentioning LogStarAgent/Error
  ue-remote.py journey NAME               # orbit -> descent -> ground screenshots into Saved/Screenshots/journeys/NAME
"""
import os, sys, time, glob, subprocess

ENGINE = os.path.expanduser('~/UnrealEngine')
PROJECT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SHOTS = os.path.join(PROJECT, 'Saved', 'Screenshots')
sys.path.insert(0, os.path.join(ENGINE, 'Engine/Plugins/Experimental/PythonScriptPlugin/Content/Python'))
import remote_execution as rex  # noqa: E402

PIE_WORLD = """
import unreal
def _pie_world():
    return unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_game_world()
"""


def connect(timeout=5.0):
    r = rex.RemoteExecution()
    r.start()
    t0 = time.time()
    while not r.remote_nodes and time.time() - t0 < timeout:
        time.sleep(0.1)
    if not r.remote_nodes:
        r.stop()
        sys.exit('no editor answered on the remote-execution multicast group; is the editor open with Remote Execution enabled?')
    r.open_command_connection(r.remote_nodes[0]['node_id'])
    return r


def run(r, code, mode=rex.MODE_EXEC_FILE):
    res = r.run_command(code, unattended=True, exec_mode=mode)
    out = ''.join(o['output'] for o in res.get('output', []))
    if not res.get('success', False):
        print(out, file=sys.stderr)
        return None
    return out


def cmd_play(r):
    # StarAgentEditorTools is our own editor-only helper around GEditor->RequestPlaySession.
    return run(r, "import unreal\nunreal.StarAgentEditorTools.start_play()\nprint('play requested')")


def cmd_stop(r):
    return run(r, "import unreal\nunreal.StarAgentEditorTools.end_play()\nprint('end play requested')")


def cmd_exec(r, command):
    return run(r, PIE_WORLD + f"w = _pie_world()\nunreal.SystemLibrary.execute_console_command(w, {command!r})\nprint('ok')")


def cmd_wait(r, seconds=30):
    t0 = time.time()
    while time.time() - t0 < seconds:
        out = run(r, PIE_WORLD + "w = _pie_world()\np = unreal.GameplayStatics.get_actor_of_class(w, unreal.PlanetActor)\nprint(p.get_editor_property('pending_count') if p else -1)")
        if out and out.strip().lstrip('-').isdigit() and int(out.strip()) == 0:
            print('streaming settled after %.1f s' % (time.time() - t0)); return True
        time.sleep(1)
    print('streaming still pending after %d s' % seconds); return False


def newest_shot(before):
    files = set(glob.glob(os.path.join(SHOTS, '**', '*.png'), recursive=True)) - before
    return max(files, key=os.path.getmtime) if files else None


def cmd_shot(r, name, size='1920x1080'):
    before = set(glob.glob(os.path.join(SHOTS, '**', '*.png'), recursive=True))
    cmd_exec(r, f'HighResShot {size} filename={name}')
    for _ in range(100):
        time.sleep(0.2)
        f = newest_shot(before)
        if f and os.path.getsize(f) > 0:
            time.sleep(0.3); print(f); return f
    print('no screenshot appeared', file=sys.stderr); return None


def cmd_goto(r, lat, lon, alt):
    return cmd_exec(r, f'SA_Goto {lat} {lon} {alt}')


def cmd_look(r, yaw, pitch):
    return cmd_exec(r, f'SA_Look {yaw} {pitch}')


def cmd_log(r, n=40):
    log = os.path.join(PROJECT, 'Saved', 'Logs', 'StarAgent.log')
    lines = [l.rstrip() for l in open(log, errors='replace') if 'LogStarAgent' in l or 'Error' in l or 'Warning: Script' in l]
    print('\n'.join(lines[-int(n):]))


def cmd_journey(r, name):
    """The browser's inspection journey: orbit, high altitude, low altitude, coast, ground."""
    stops = [('orbit', 12.0, -60.0, 3_000_000, 0, -60), ('high', 12.0, -60.0, 120_000, 20, -45), ('low', 12.0, -60.0, 3_000, 20, -20),
             ('coast', 12.0, -60.0, 300, 45, -8), ('ground', 12.0, -60.0, 2, 90, 0)]
    for label, lat, lon, alt, yaw, pitch in stops:
        cmd_goto(r, lat, lon, alt); cmd_look(r, yaw, pitch); cmd_wait(r, 25); time.sleep(1.0)
        cmd_shot(r, f'journeys/{name}/{label}')


def main():
    if len(sys.argv) < 2:
        print(__doc__); return
    op, args = sys.argv[1], sys.argv[2:]
    r = connect()
    try:
        if op == 'ping': print(r.remote_nodes)
        elif op == 'py': print(run(r, args[0]) or '')
        elif op == 'play': print(cmd_play(r) or '')
        elif op == 'stop': print(cmd_stop(r) or '')
        elif op == 'exec': print(cmd_exec(r, args[0]) or '')
        elif op == 'goto': cmd_goto(r, *args[:3])
        elif op == 'look': cmd_look(r, *args[:2])
        elif op == 'wait': cmd_wait(r, int(args[0]) if args else 30)
        elif op == 'shot': cmd_shot(r, args[0], args[1] if len(args) > 1 else '1920x1080')
        elif op == 'log': cmd_log(r, args[0] if args else 40)
        elif op == 'journey': cmd_journey(r, args[0] if args else time.strftime('%Y%m%d-%H%M'))
        else: print(__doc__)
    finally:
        r.stop()


if __name__ == '__main__':
    main()
