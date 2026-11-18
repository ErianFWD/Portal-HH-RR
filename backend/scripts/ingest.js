import {db} from '../server/db.js';
import {syncDrive} from '../server/ingestion.js';
try{console.log(JSON.stringify(await syncDrive(db,{trigger:'cli'}),null,2));}catch(e){console.error('Ingesta:',e.code||e.message);process.exitCode=1;}finally{await db.end();}
