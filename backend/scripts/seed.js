import bcrypt from 'bcryptjs';
import {db} from '../server/db.js';
import {config} from '../server/config.js';

if (config.NODE_ENV !== 'development') throw Error('Los datos de prueba solo se cargan en desarrollo');
if (config.DEMO_PASSWORD && config.DEMO_PASSWORD.length < 12) throw Error('DEMO_PASSWORD debe tener al menos 12 caracteres o estar vacía');

const c = await db.connect();
try {
  await c.query('BEGIN');
  const existing = await c.query('SELECT COUNT(*) AS total FROM colaboradores');
  if (Number(existing.rows[0].total) !== 0) throw Error('La tabla colaboradores no está vacía; se cancela el seed para preservar los datos existentes');
  const hash = config.DEMO_PASSWORD ? await bcrypt.hash(config.DEMO_PASSWORD, 12) : null;
  const departments = ['Operaciones', 'Finanzas', 'Tecnología', 'RRHH', 'Ventas'];
  // 250 personas activas y una salida ficticia para los reportes posteriores.
  for (let i = 1; i <= 251; i++) {
    await c.query('INSERT INTO colaboradores(id,nombre,departamento,activo) VALUES($1,$2,$3,$4)', [i, `Persona ficticia ${i}`, departments[(i-1)%departments.length], i !== 251]);
    await c.query('INSERT INTO saldos_vacaciones(colaborador_id,dias) VALUES($1,$2)', [i, 5+i%25]);
    if (hash && i <= 2) await c.query('INSERT INTO usuarios(colaborador_id,email,password_hash,rol) VALUES($1,$2,$3,$4)', [i, i === 1 ? 'colaborador@demo.local' : 'rrhh@demo.local', hash, i === 1 ? 'colaborador' : 'rrhh']);
    await c.query('INSERT INTO movimientos_personal(colaborador_id,tipo,fecha) VALUES($1,$2,DATE_SUB(CURRENT_DATE, INTERVAL $3 DAY))', [i, i === 251 ? 'salida' : 'ingreso', i*7%90]);
    if (i%5 === 0 && i !== 251) await c.query("INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha) VALUES($1,'vacaciones','pendiente',DATE_SUB(CURRENT_DATE, INTERVAL $2 DAY))", [i,i%20+1]);
    if (i%10 === 0 && i !== 251) await c.query('INSERT INTO incapacidades(colaborador_id,inicio,fin) VALUES($1,DATE_SUB(CURRENT_DATE, INTERVAL 2 DAY),DATE_ADD(CURRENT_DATE, INTERVAL 2 DAY))', [i]);
  }
  await c.query('COMMIT');
  console.log(`Cargados 250 colaboradores activos y una salida ficticia.${hash ? ' Usuarios de demostración creados.' : ' Sin usuarios de demostración: configurá DEMO_PASSWORD para crearlos.'}`);
} catch (e) {
  await c.query('ROLLBACK');
  throw e;
} finally {
  c.release();
  await db.end();
}
