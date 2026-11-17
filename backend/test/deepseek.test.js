import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generatePolicyAnswer} from '../server/agents/deepseek.js';

test('envía evidencia a DeepSeek y recibe la respuesta completa', async () => {
  let request;
  const fetchImpl=async (url, options)=>{request={url,options}; return {ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'Respuesta sustentada'}}]})}};
  const answer=await generatePolicyAnswer({apiKey:'test-key',model:'deepseek-flash',question:'¿Cuál es la política?',evidence:[{nombre:'Política',contenido:'Texto de prueba'}],fetchImpl});
  assert.equal(answer,'Respuesta sustentada');
  assert.equal(request.url,'https://api.deepseek.com/chat/completions');
  const body=JSON.parse(request.options.body);
  assert.equal(body.model,'deepseek-flash');
  assert.equal(body.thinking.type,'disabled');
  assert.match(body.messages[1].content,/Texto de prueba/);
});

test('rechaza errores y respuestas incompletas de DeepSeek', async () => {
  const args={apiKey:'test-key',model:'deepseek-flash',question:'?',evidence:[]};
  await assert.rejects(generatePolicyAnswer({...args,fetchImpl:async()=>({ok:false,status:401})}),/401/);
  await assert.rejects(generatePolicyAnswer({...args,fetchImpl:async()=>({ok:true,json:async()=>({choices:[{finish_reason:'length',message:{content:'incompleto'}}]})})}),/respuesta completa/);
});
