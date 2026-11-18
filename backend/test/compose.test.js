import {test} from 'node:test';
import assert from 'node:assert/strict';
import {policyPartOnly} from '../server/agents/compose.js';
test('la composición mixta elimina una abstención sobre el dato que SQL ya respondió',()=>{
  const rule='Los días pendientes no caducan automáticamente. No se autoriza acumulación indefinida por chat y superar 20 días es una alerta administrativa.';
  const result=policyPartOnly('No hay evidencia suficiente para determinar cuántos días te quedan: corresponde al agente de datos. '+rule);
  assert.equal(result,rule);
});
test('conserva una abstención normativa y no altera reglas o cifras',()=>{for(const text of ['No encontré evidencia suficiente sobre ese beneficio.','No se autoriza acumulación indefinida.','El saldo no caduca automáticamente y superar 20 días genera una alerta.'])assert.equal(policyPartOnly(text),text);});
