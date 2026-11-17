import bcrypt from 'bcryptjs';
import {db} from '../server/db.js';
import {config} from '../server/config.js';

if (config.NODE_ENV !== 'development' || !config.DEMO_PASSWORD || config.DEMO_PASSWORD.length < 12) {
  throw Error('En desarrollo, configurá DEMO_PASSWORD con al menos 12 caracteres');
}
const c=await db.connect();
try {
  await c.query('BEGIN');
  const hash=await bcrypt.hash(config.DEMO_PASSWORD,12);
  for (const [id,email,role] of [[1,'colaborador@demo.local','colaborador'],[2,'rrhh@demo.local','rrhh']]) {
    const existing=await c.query('SELECT id FROM usuarios WHERE colaborador_id=$1 OR email=$2',[id,email]);
    if (existing.rows.length) throw Error('Ya existe un usuario con el correo o colaborador de demostración; no se reemplazará');
    await c.query('INSERT INTO usuarios(colaborador_id,email,password_hash,rol) VALUES($1,$2,$3,$4)',[id,email,hash,role]);
  }
  await c.query('COMMIT');
  console.log('Usuarios de demostración creados');
} catch (error) {
  await c.query('ROLLBACK');
  throw error;
} finally {
  c.release();
  await db.end();
}
