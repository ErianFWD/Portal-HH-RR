import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {extractPdfText,policyVersion} from '../server/ingestion.js';
import {embedMany} from '../server/agents/embeddings.js';
test('extrae PDF real y libera el loading task sin ocultar el texto con un TypeError',async()=>{const text=await extractPdfText(await readFile(new URL('../../docs/paquete_rrhh/Documentacion_RRHH/politicas/POL-02.pdf',import.meta.url)));assert.match(text,/Licencias legales/);assert.match(text,/Matrimonio/);});
test('distingue la versión de política del número de revisión de Drive',()=>{assert.equal(policyVersion('POL-01 · Versión 1.0 · Vigencia 2026-11-17'),'1.0');assert.equal(policyVersion('Sin versión declarada'),null);});
test('agrupa embeddings y reintenta 429 respetando retry-after',async()=>{let calls=0,body,wait;const result=await embedMany(['primero','segundo'],'document',{fetchImpl:async(url,options)=>{body=JSON.parse(options.body);calls++;return calls===1?{status:429,headers:{get:()=>2}}:{ok:true,json:async()=>({data:[{index:1,embedding:Array(1024).fill(2)},{index:0,embedding:Array(1024).fill(1)}]})};},sleep:async ms=>{wait=ms;}});assert.equal(calls,2);assert.equal(wait,2000);assert.deepEqual(body.input,['primero','segundo']);assert.equal(JSON.parse(result[0])[0],1);});
