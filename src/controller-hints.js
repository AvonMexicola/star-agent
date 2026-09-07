/** Actual contextual bindings. Construction renders its richer placement panel. */
export function controllerHints({mode,insideShip=false,dockedAtStation=false,canBuild=false,tool='mining-laser-tool',handsFree=false}){
  const menus=[['VIEW','BACKPACK'],['MENU','COMMANDS'],['LB + RB','SHORTCUTS']];
  if(mode==='walk'&&handsFree)return [['LS','MOVE'],['RS','LOOK'],['A','JUMP'],['X','INTERACT'],['↑ / ↓','QUICK / USE'],...menus];
  if(mode==='eva')return [['LS','MOVE'],['RS','LOOK'],['A / B','RISE / LOWER'],['LT','BRAKE'],['RT',tool==='mining-laser-tool'?'MINE':'FIRE'],['LB / RB','ROLL'],['X','INTERACT'],['Y','SUIT'],...menus];
  if(mode==='walk')return [['LS','MOVE'],['RS','LOOK'],...(!insideShip?[['A','JUMP'],...(!dockedAtStation?[['B',canBuild?'BUILD WHEEL':'BUILD · NEED MAINFRAME']]:[])]:[]),['RT',tool==='mining-laser-tool'?'MINE':'FIRE'],['X','INTERACT'],...(!insideShip&&!dockedAtStation?[['Y','SUIT']]:[]),['D-PAD ← / →','CYCLE / TOOL'],['↑ / ↓','QUICK / USE'],...menus];
  if(mode==='landed')return [['RS','LOOK'],['Y','LAUNCH'],['X','STAND'],...menus];
  return [['LS','MOVE'],['RS','LOOK'],['RT','FIRE'],['LT','BRAKE'],['A / B','UP / DOWN'],['LB / RB','ROLL'],['Y','LAND'],['X','INTERACT / EVA'],['R3','ASSIST'],['↑ / ↓','SPEED'],...menus];
}
