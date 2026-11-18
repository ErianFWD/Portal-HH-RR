import {db} from '../server/db.js';
import {policyVersion} from '../server/ingestion.js';
try{
  const docs=(await db.query('SELECT id,nombre FROM documentos WHERE aprobado=1')).rows;let count=0;
  for(const doc of docs){const text=(await db.query('SELECT contenido FROM fragmentos WHERE documento_id=$1 ORDER BY orden,id',[doc.id])).rows.map(r=>r.contenido).join('\n');const version=policyVersion(text);if(version){await db.query('UPDATE documentos SET version_politica=$1 WHERE id=$2',[version,doc.id]);count++;}}
  console.log('Versiones declaradas extraídas del texto indexado: '+count);
}finally{await db.end();}
