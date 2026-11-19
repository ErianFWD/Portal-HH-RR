import {businessDays} from '../server/calendar.js';

export async function up(db) {
  async function add(table,column,definition) {
    if(!(await db.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=$1 AND COLUMN_NAME=$2',[table,column])).rows.length)await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  for(const [column,definition] of Object.entries({mensaje:'VARCHAR(2000)',respuesta_rrhh:'VARCHAR(2000)',dias_solicitados:'DECIMAL(6,2)',gestion_portal:'BOOLEAN NOT NULL DEFAULT FALSE',resuelto_por:'INT REFERENCES usuarios(id)'}))await add('solicitudes',column,definition);
  if(!(await db.query("SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='solicitudes' AND CONSTRAINT_NAME='fk_solicitud_resuelto_por'")).rows.length)await db.query('ALTER TABLE solicitudes ADD CONSTRAINT fk_solicitud_resuelto_por FOREIGN KEY(resuelto_por) REFERENCES usuarios(id)');
  if(!(await db.query("SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='solicitudes' AND INDEX_NAME='idx_solicitud_conflictos'")).rows.length)await db.query('CREATE INDEX idx_solicitud_conflictos ON solicitudes(colaborador_id,estado,fecha_inicio,fecha_fin)');
  await db.query(`CREATE TABLE IF NOT EXISTS calendarios_cobertura(anio INT PRIMARY KEY,fuente VARCHAR(255) NOT NULL,confirmado_por INT,confirmado_en DATETIME NOT NULL,FOREIGN KEY(confirmado_por) REFERENCES usuarios(id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS movimientos_vacaciones(id BIGINT AUTO_INCREMENT PRIMARY KEY,colaborador_id INT NOT NULL,solicitud_id INT UNIQUE,tipo VARCHAR(40) NOT NULL,delta DECIMAL(6,2) NOT NULL,saldo_anterior DECIMAL(6,2) NOT NULL,saldo_nuevo DECIMAL(6,2) NOT NULL,usuario_id INT,creado_en DATETIME NOT NULL,FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id),FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id),INDEX(colaborador_id,creado_en))`);
  await db.query(`CREATE TABLE IF NOT EXISTS solicitudes_auditoria(id BIGINT AUTO_INCREMENT PRIMARY KEY,solicitud_id INT NOT NULL,usuario_id INT NOT NULL,estado_anterior VARCHAR(100),estado_nuevo VARCHAR(100) NOT NULL,mensaje VARCHAR(2000),creado_en DATETIME NOT NULL,FOREIGN KEY(solicitud_id) REFERENCES solicitudes(id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS horarios(id INT AUTO_INCREMENT PRIMARY KEY,colaborador_id INT NOT NULL,vigente_desde DATE NOT NULL,dias JSON NOT NULL,entrada TIME NOT NULL,salida TIME NOT NULL,tolerancia_min INT NOT NULL,motivo VARCHAR(2000) NOT NULL,usuario_id INT,creado_en DATETIME NOT NULL,FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id),INDEX(colaborador_id,vigente_desde,id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS asistencia(id INT AUTO_INCREMENT PRIMARY KEY,colaborador_id INT NOT NULL,entrada DATETIME(3) NOT NULL,salida DATETIME(3),abierta_colaborador INT GENERATED ALWAYS AS (CASE WHEN salida IS NULL THEN colaborador_id ELSE NULL END) STORED UNIQUE,incidencias JSON NOT NULL,horario_snapshot JSON NOT NULL,observaciones VARCHAR(2000),corregida BOOLEAN NOT NULL DEFAULT FALSE,FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id),INDEX(colaborador_id,entrada))`);
  await db.query(`CREATE TABLE IF NOT EXISTS asistencia_correcciones(id BIGINT AUTO_INCREMENT PRIMARY KEY,asistencia_id INT NOT NULL,usuario_id INT NOT NULL,motivo VARCHAR(2000) NOT NULL,original JSON NOT NULL,nuevo JSON NOT NULL,creado_en DATETIME NOT NULL,FOREIGN KEY(asistencia_id) REFERENCES asistencia(id),FOREIGN KEY(usuario_id) REFERENCES usuarios(id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS marcas_idempotencia(colaborador_id INT NOT NULL,clave VARCHAR(80) NOT NULL,accion VARCHAR(10) NOT NULL,asistencia_id INT NOT NULL,PRIMARY KEY(colaborador_id,clave),FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id),FOREIGN KEY(asistencia_id) REFERENCES asistencia(id))`);
  // Únicamente el importador conocido certifica este calendario; no se infiere cobertura contando feriados.
  await db.query(`INSERT IGNORE INTO calendarios_cobertura(anio,fuente,confirmado_en) SELECT 2026,'seed historia-y-calendarios-2026-v1',UTC_TIMESTAMP() FROM seed_versiones WHERE nombre='historia-y-calendarios-2026-v1'`);
  const c=await db.connect();
  try {
    await c.query('BEGIN');
    // Esta fila bloqueada serializa dos ejecuciones simultáneas de la migración de datos.
    await c.query("INSERT IGNORE INTO seed_versiones VALUES('flujos-003-lock',UTC_TIMESTAMP())");
    await c.query("SELECT nombre FROM seed_versiones WHERE nombre='flujos-003-lock' FOR UPDATE");
    if(!(await c.query("SELECT nombre FROM seed_versiones WHERE nombre='flujos-003-v1'")).rows.length){
      // dias es la autoridad histórica. Se conserva y se reconcilian los componentes con un ajuste explícito.
      await c.query('UPDATE saldos_vacaciones SET dias_asignados=COALESCE(dias_asignados,dias),dias_tomados=COALESCE(dias_tomados,0),ajustes=dias-COALESCE(dias_asignados,dias)+COALESCE(dias_tomados,0)');
      await c.query("INSERT INTO movimientos_vacaciones(colaborador_id,tipo,delta,saldo_anterior,saldo_nuevo,creado_en) SELECT colaborador_id,'apertura_historica',0,dias,dias,UTC_TIMESTAMP() FROM saldos_vacaciones");
      for(const row of (await c.query("SELECT id,fecha_inicio,fecha_fin FROM solicitudes WHERE tipo='vacaciones' AND estado='pendiente'")).rows){
        const days=await businessDays(c,String(row.fecha_inicio).slice(0,10),String(row.fecha_fin).slice(0,10));
        await c.query('UPDATE solicitudes SET dias_solicitados=$1 WHERE id=$2',[days,row.id]);
      }
      await c.query("INSERT INTO seed_versiones VALUES('flujos-003-v1',UTC_TIMESTAMP())");
    }
    await c.query("INSERT INTO horarios(colaborador_id,vigente_desde,dias,entrada,salida,tolerancia_min,motivo,creado_en) SELECT c.id,'1900-01-01','[1,2,3,4,5]','08:00:00','17:00:00',0,'Horario inicial documentado',UTC_TIMESTAMP() FROM colaboradores c WHERE NOT EXISTS(SELECT 1 FROM horarios h WHERE h.colaborador_id=c.id)");
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
