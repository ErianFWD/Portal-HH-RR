export async function up(db) {
  async function add(table,column,definition) {
    const r=await db.query('SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=$1 AND COLUMN_NAME=$2',[table,column]);
    if(!r.rows.length)await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  for(const [table,columns] of Object.entries({
    colaboradores:{puesto:'VARCHAR(120)',fecha_ingreso:'DATE',fecha_salida:'DATE',jefe_id:'INT',grupo_planilla:"VARCHAR(50) NOT NULL DEFAULT 'general'"},
    usuarios:{activo:'BOOLEAN NOT NULL DEFAULT TRUE'},
    saldos_vacaciones:{periodo_inicio:'DATE',periodo_fin:'DATE',dias_asignados:'DECIMAL(6,2)',dias_tomados:'DECIMAL(6,2)',ajustes:'DECIMAL(6,2) NOT NULL DEFAULT 0',actualizado_en:'DATETIME'},
    solicitudes:{fecha_inicio:'DATE',fecha_fin:'DATE',aprobador_id:'INT',creada_en:'DATETIME',resuelta_en:'DATETIME',fixture_clave:'VARCHAR(80) UNIQUE'},
    incapacidades:{entidad:'VARCHAR(60)',tipo_administrativo:'VARCHAR(60)',referencia_simulada:'VARCHAR(80)'},
    movimientos_personal:{motivo_simulado:'VARCHAR(255)'},
    calendario_pagos:{fecha_nominal:'DATE',tipo:"VARCHAR(50) DEFAULT 'salario'",grupo_planilla:"VARCHAR(50) DEFAULT 'general'",clave:'VARCHAR(100) UNIQUE',fuente:'VARCHAR(255)'},
    documentos:{carpeta_id:'VARCHAR(255)',estado:"VARCHAR(30) NOT NULL DEFAULT 'borrador'",vigente_desde:'DATE',vigente_hasta:'DATE',hash_contenido:'CHAR(64)',mime_type:'VARCHAR(180)',responsable:'VARCHAR(255)',error:'TEXT',version_politica:'VARCHAR(80)'},
    fragmentos:{pagina:'INT',orden:'INT',modelo_embedding:'VARCHAR(100)',dimension:'INT NOT NULL DEFAULT 1024'},
    consultas_chat:{conversacion_id:'BIGINT',colaborador_id:'INT',intencion:'VARCHAR(50)',tema:'VARCHAR(50)',resuelta:'BOOLEAN NOT NULL DEFAULT FALSE',escalada:'BOOLEAN NOT NULL DEFAULT FALSE',latencia_total_ms:'INT',estado:"VARCHAR(30) NOT NULL DEFAULT 'pendiente'",respuesta:'TEXT',citas:'JSON',error:'VARCHAR(80)'},
    intervenciones:{error:'VARCHAR(80)'},
    reportes_diarios:{zona:"VARCHAR(80) DEFAULT 'America/Costa_Rica'",estado:"VARCHAR(30) DEFAULT 'completado'",generado_en:'DATETIME',version_metodo:'VARCHAR(50)',error:'VARCHAR(255)',resumen_metodo:'VARCHAR(50)',disparador:'VARCHAR(50)'},
  }))for(const [column,definition] of Object.entries(columns))await add(table,column,definition);
  await db.query(`CREATE TABLE IF NOT EXISTS evaluaciones_desempeno(id INT AUTO_INCREMENT PRIMARY KEY,colaborador_id INT NOT NULL,fecha_programada DATE NOT NULL,estado VARCHAR(40) NOT NULL,clave VARCHAR(100) UNIQUE,FOREIGN KEY(colaborador_id) REFERENCES colaboradores(id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS feriados(fecha DATE PRIMARY KEY,nombre VARCHAR(255) NOT NULL,clasificacion VARCHAR(100),fuente TEXT)`);
  await db.query(`CREATE TABLE IF NOT EXISTS conversaciones(id BIGINT AUTO_INCREMENT PRIMARY KEY,usuario_id INT NOT NULL,titulo VARCHAR(120) NOT NULL,creada_en DATETIME NOT NULL,FOREIGN KEY(usuario_id) REFERENCES usuarios(id))`);
  await db.query(`CREATE TABLE IF NOT EXISTS drive_estado(carpeta_id VARCHAR(255) PRIMARY KEY,page_token TEXT,ultimo_exito DATETIME,ultimo_intento DATETIME,resultado JSON)`);
  await db.query(`CREATE TABLE IF NOT EXISTS ejecuciones_reporte(id BIGINT AUTO_INCREMENT PRIMARY KEY,fecha DATE NOT NULL,disparador VARCHAR(80),estado VARCHAR(30),error VARCHAR(100),creado DATETIME NOT NULL)`);
  await db.query(`CREATE TABLE IF NOT EXISTS seed_versiones(nombre VARCHAR(100) PRIMARY KEY,aplicado_en DATETIME NOT NULL)`);
  await db.query(`UPDATE solicitudes SET fecha_inicio=COALESCE(fecha_inicio,fecha),fecha_fin=COALESCE(fecha_fin,fecha),creada_en=COALESCE(creada_en,CAST(fecha AS DATETIME)) WHERE fecha_inicio IS NULL OR creada_en IS NULL`);
  await db.query(`UPDATE saldos_vacaciones SET dias_asignados=COALESCE(dias_asignados,dias),dias_tomados=COALESCE(dias_tomados,0),actualizado_en=COALESCE(actualizado_en,UTC_TIMESTAMP())`);
}
