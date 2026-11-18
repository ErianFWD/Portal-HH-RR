import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cosineSimilarity, rankChunks} from '../server/agents/vector.js';
const vector=(x,y)=>[x,y,...Array(1022).fill(0)];
test('ordena evidencia por similitud coseno y descarta evidencia insuficiente',()=>{
 const rows=[{id:'irrelevante',embedding:vector(0,1)},{id:'cercana',embedding:JSON.stringify(vector(1,0))},{id:'invalida',embedding:'no es JSON'}];
 assert.deepEqual(rankChunks(rows,vector(1,0)).map(row=>row.id),['cercana']);
 assert.equal(cosineSimilarity(vector(0,0),vector(1,0)),null);
});
test('recuperación híbrida encuentra términos específicos aunque el coseno sea bajo',()=>{const rows=[{id:1,nombre:'Permisos',seccion:'Duelo',contenido:'Beneficio por matrimonio documentado',embedding:vector(0,1)},{id:2,nombre:'Jornada',contenido:'Horario ordinario',embedding:vector(0,1)}];assert.deepEqual(rankChunks(rows,vector(1,0),.3,{question:'¿Tengo permiso por matrimonio?'}).map(r=>r.id),[1]);});
