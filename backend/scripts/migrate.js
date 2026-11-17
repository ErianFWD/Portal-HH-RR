import {readFile} from 'node:fs/promises'; import {db} from '../server/db.js';
try {const sql=await readFile(new URL('../migrations/001.sql',import.meta.url),'utf8'); for(const statement of sql.split(';').map(x=>x.trim()).filter(Boolean)) await db.query(statement); console.log('Migración MySQL aplicada');} finally {await db.end()}
