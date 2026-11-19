import {readFile} from 'node:fs/promises';
import {db} from '../server/db.js';
import {up} from '../migrations/002_portal.js';
import {up as workflows} from '../migrations/003_workflows.js';
try {
  const sql=await readFile(new URL('../migrations/001.sql',import.meta.url),'utf8');
  for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean))await db.query(statement);
  await up(db);
  await workflows(db);
  console.log('Migraciones MySQL aplicadas (001, 002 y 003, aditivas e idempotentes)');
} finally {await db.end()}
