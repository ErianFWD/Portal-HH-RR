import {localDate,localHour,addDays} from './time.js';
import {generateDailyReport} from './agents/analyst.js';
import {syncDrive} from './ingestion.js';

export function startJobs(db,config,{now=()=>new Date(),onError=e=>console.error('Job:',e.code||e.name)}={}) {
  if(config.JOBS_ENABLED!=='true')return ()=>{};
  let running=false;
  async function tick(){
    if(running)return;running=true;
    try {
      const date=localDate(now()),latest=localHour(now())>=7?date:addDays(date,-1);
      const last=(await db.query('SELECT MAX(fecha) fecha FROM reportes_diarios WHERE estado=$1 AND version_metodo IS NOT NULL',['completado'])).rows[0]?.fecha;
      // Recupera hasta treinta fechas después de una interrupción; instalación nueva: último corte.
      let next=last?addDays(String(last instanceof Date?last.toISOString():last).slice(0,10),1):latest;
      if(next<addDays(latest,-29))next=addDays(latest,-29);
      while(next<=latest){await generateDailyReport(db,{date:next,trigger:'scheduler'});next=addDays(next,1);}
      if(config.DRIVE_FOLDER_ID){const state=(await db.query('SELECT ultimo_exito FROM drive_estado WHERE carpeta_id=$1',[config.DRIVE_FOLDER_ID])).rows[0];
        if(!state?.ultimo_exito||localDate(new Date(state.ultimo_exito))<date)await syncDrive(db,{trigger:'scheduler'});
      }
    }catch(error){onError(error);}finally{running=false;}
  }
  void tick();const timer=setInterval(tick,60000);timer.unref();return ()=>clearInterval(timer);
}
