import {db} from '../server/db.js';
import {policy} from '../server/agents/policy.js';
import {route,buildSearchQuestion} from '../server/agents/router.js';
const question=process.argv[2];if(!question)throw Error('Indicá la pregunta de prueba');
try{const routing=await route(question,{rol:'colaborador'},'2026-11-17');console.log(JSON.stringify({routing}));const result=await policy(db,question,'2026-11-17',{searchQuestion:buildSearchQuestion(question,routing.consulta_reformulada),onDecision:d=>console.log(JSON.stringify(d,null,2))});console.log(JSON.stringify(result));}finally{await db.end();}
