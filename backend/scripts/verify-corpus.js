import {writeFile,readFile} from 'node:fs/promises';
import {db} from '../server/db.js';
import {config} from '../server/config.js';
import {createDriveClient,inventory} from '../server/ingestion.js';
try{
  const drive=createDriveClient(),files=await inventory(drive,config.DRIVE_FOLDER_ID),capabilities=(await drive.files.get({fileId:config.DRIVE_FOLDER_ID,fields:'id,name,capabilities(canEdit,canAddChildren)'},{timeout:15000})).data;
  const manifest=JSON.parse(await readFile(config.DEMO_APPROVAL_MANIFEST,'utf8'));
  const docs=(await db.query('SELECT d.id,d.nombre,d.version,d.version_politica,d.enlace,d.vigente_desde,d.vigente_hasta,COUNT(f.id) fragmentos,MIN(f.dimension) dimension,MIN(f.modelo_embedding) modelo FROM documentos d JOIN fragmentos f ON f.documento_id=d.id WHERE d.aprobado=1 GROUP BY d.id')).rows;
  const errors=[];
  for(const id of Object.keys(manifest.archivos)){const remote=files.get(id),doc=docs.find(d=>d.id===id);if(!remote||!doc||String(remote.version)!==String(doc.version)||doc.enlace!==remote.webViewLink||Number(doc.fragmentos)<1||Number(doc.dimension)!==1024||doc.modelo!==config.VOYAGE_MODEL)errors.push(id);}
  const result={verificado_en:new Date().toISOString(),carpeta:capabilities,documentos:docs,errores:errors,aprobada:errors.length===0&&docs.length===12};
  await writeFile(new URL('../../docs/resultados/verificacion_corpus.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify({documentos:docs.length,fragmentos:docs.reduce((n,d)=>n+Number(d.fragmentos),0),permisos:capabilities.capabilities,errores:errors}));
  if(!result.aprobada)process.exitCode=1;
}finally{await db.end();}
