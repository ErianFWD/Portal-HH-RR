import {config} from './config.js';

export async function completion(system,payload,{fetchImpl=fetch,json=false,maxTokens=600}={}) {
  if(!config.DEEPSEEK_API_KEY)throw Error('LLM_NO_CONFIGURADO');
  const response=await fetchImpl('https://api.deepseek.com/chat/completions',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.DEEPSEEK_API_KEY}`},
    body:JSON.stringify({model:config.DEEPSEEK_MODEL,max_tokens:maxTokens,thinking:{type:'disabled'},...(json?{response_format:{type:'json_object'}}:{}),messages:[{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}]}),signal:AbortSignal.timeout(config.LLM_TIMEOUT_MS),
  });
  if(!response.ok)throw Error('LLM_HTTP_'+response.status);
  const choice=(await response.json()).choices?.[0];
  if(choice?.finish_reason!=='stop'||!choice.message?.content?.trim())throw Error('LLM_RESPUESTA_INCOMPLETA');
  return json?JSON.parse(choice.message.content):choice.message.content.trim();
}
