import {readFile} from 'node:fs/promises';
import {db} from '../server/db.js';
import {up} from '../migrations/002_portal.js';
try {
  const sql=await readFile(new URL('../migrations/001.sql',import.meta.url),'utf8');
  for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await db.query(statement);
  await up(db);
  console.log('Migraciones MySQL aplicadas (001 y 002, aditivas e idempotentes)');
} finally {await db.end()}
