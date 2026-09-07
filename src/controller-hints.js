/** Actual contextual bindings. Construction renders its richer placement panel. */
export function controllerHints({mode,insideShip=false,canBuild=false,tool='mining-laser-tool'}){
  const menus=[['VIEW','BACKPACK'],['MENU','COMMANDS']];
  if(mode==='eva')return [['LS','MOVE'],['RS','LOOK'],['A / B','RISE / LOWER'],['LT','BRAKE'],['RT',tool==='mining-laser-tool'?'MINE':'FIRE'],['LB / RB','ROLL'],['X','INTERACT'],['Y','SUIT'],...menus];
  if(mode==='walk')return [['LS','MOVE'],['RS','LOOK'],...(!insideShip?[['A','JUMP'],['B',canBuild?'BUILD WHEEL':'BUILD · NEED MAINFRAME'],['RT',tool==='mining-laser-tool'?'MINE':'FIRE']]:[]),['X','INTERACT'],...(!insideShip?[['Y','SUIT'],['D-PAD ← / →','CYCLE / TOOL'],['↑ / ↓','QUICK / USE']]:[]),...menus];
  if(mode==='landed')return [['RS','LOOK'],['Y','LAUNCH'],['X','STAND'],...menus];
  return [['LS','MOVE'],['RS','LOOK'],['RT / LT','RISE / DESCEND'],['LB / RB','ROLL'],['A','FIRE'],['B','BRAKE'],['Y','LAND'],['X','STAND'],['R3','ASSIST'],['↑ / ↓','SPEED'],...menus];
}
