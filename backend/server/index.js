import {config} from './config.js';
import {db} from './db.js';
import {createApp} from './app.js';
import {startJobs} from './jobs.js';
const stopJobs=startJobs(db,config);
const server=createApp(db,config).listen(config.PORT,'127.0.0.1',()=>console.log('API en http://127.0.0.1:'+config.PORT));
async function close(){stopJobs();server.close(async()=>{await db.end();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
