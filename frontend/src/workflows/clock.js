export const clockAnchor=(serverNow,monotonicNow)=>({server:Date.parse(serverNow),client:monotonicNow});
export const serverTime=(anchor,monotonicNow)=>anchor.server+Math.max(0,monotonicNow-anchor.client);
export const recordedSeconds=(row,now)=>Math.max(0,Math.floor(((row.salida?Date.parse(row.salida):now)-Date.parse(row.entrada))/1000));
