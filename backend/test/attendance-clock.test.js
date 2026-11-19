import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clockAnchor,serverTime,recordedSeconds} from '../../frontend/src/workflows/clock.js';

test('contador recupera el intervalo persistido al recargar y compensa reloj local desfasado',()=>{
  const row={entrada:'2026-11-19T05:30:00.000Z',salida:null};
  const first=clockAnchor('2026-11-19T05:45:00.000Z',500);
  assert.equal(recordedSeconds(row,serverTime(first,10500)),910);
  // Otra sesión/navegador tiene un origen monotónico distinto; la misma entrada viene de SQL.
  const reloaded=clockAnchor('2026-11-19T06:15:00.000Z',3);
  assert.equal(recordedSeconds(row,serverTime(reloaded,1003)),2701);
  assert.equal(recordedSeconds({...row,salida:'2026-11-19T06:30:00.000Z'},serverTime(reloaded,999999)),3600);
});
