import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {Sequelize} from 'sequelize';
import {db,databaseAdapter} from '../server/db.js';
import {config} from '../server/config.js';
import {businessDays} from '../server/calendar.js';

test('instalación nueva: migrar, seed, fixture y calendario conservan saldos y reservas',async()=>{
  const name='portalrrhh_seed_test_'+process.pid;assert.match(name,/^portalrrhh_seed_test_\d+$/);
  const url=new URL(config.DATABASE_URL);url.pathname='/'+name;let created=false,target;
  try{
    await db.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4');created=true;
    target=databaseAdapter(new Sequelize(url.toString(),{logging:false,timezone:'+00:00'}));
    const run=promisify(execFile),env={...process.env,DATABASE_URL:url.toString(),NODE_ENV:'development',DEMO_PASSWORD:'',JOBS_ENABLED:'false',ANALYST_LLM_ENABLED:'false'};
    for(const script of ['migrate','seed','seed-fixture','seed-history','migrate'])await run(process.execPath,[fileURLToPath(new URL('../scripts/'+script+'.js',import.meta.url))],{env,windowsHide:true});
    const bad=(await target.query('SELECT colaborador_id FROM saldos_vacaciones WHERE dias<>dias_asignados-dias_tomados+ajustes')).rows;assert.equal(bad.length,0);
    for(const s of (await target.query("SELECT fecha_inicio,fecha_fin,dias_solicitados FROM solicitudes WHERE estado='pendiente' AND tipo='vacaciones'")).rows)assert.equal(Number(s.dias_solicitados),await businessDays(target,s.fecha_inicio,s.fecha_fin));
    assert.equal(Number((await target.query('SELECT COUNT(*) n FROM horarios')).rows[0].n),251);
    assert.equal(Number((await target.query('SELECT COUNT(*) n FROM calendarios_cobertura WHERE anio=2026')).rows[0].n),1);
    assert.equal(Number((await target.query("SELECT saldo_nuevo FROM movimientos_vacaciones WHERE colaborador_id=1 ORDER BY id DESC LIMIT 1")).rows[0].saldo_nuevo),12);
  }finally{if(target)await target.end();if(created)await db.query('DROP DATABASE IF EXISTS `'+name+'`');await db.end();}
});
