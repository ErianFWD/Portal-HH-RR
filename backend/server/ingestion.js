import {createHash} from 'node:crypto';
import {google} from 'googleapis';
import {config} from './config.js';
import {embed,embedMany} from './agents/embeddings.js';
import {readFile} from 'node:fs/promises';

const FOLDER='application/vnd.google-apps.folder';
const fields='id,name,mimeType,parents,modifiedTime,version,webViewLink,trashed,description,size';
const supported=new Set(['application/vnd.google-apps.document','application/vnd.google-apps.spreadsheet','application/pdf','text/plain','text/markdown','text/csv','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const options={timeout:20000};
export function policyVersion(text){return text.match(/Versi[oó]n\s*[:=]?\s*(\d+(?:\.\d+)+)/i)?.[1]||null;}
export function chunkDocument(text,{maxChars=2800,overlap=350}={}) {
  const result=[],sections=[];let section='Contenido',content=[];
  for(const line of text.replace(/\r/g,'').split('\n')){
    if(/^(#{1,6}\s|\d{1,2}[.)]?\s+[A-ZÁÉÍÓÚÑ]|§\s*\d+)/.test(line.trim())){if(content.join('').trim())sections.push({section,text:content.join('\n')});section=line.replace(/^#+\s*/,'').trim().slice(0,255);content=[line];}
    else content.push(line);
  }
  if(content.join('').trim())sections.push({section,text:content.join('\n')});
  for(const block of sections) {
    const trimmed=block.text.trim();if(!trimmed)continue;
    for(let i=0;i<trimmed.length;) {
      let end=Math.min(i+maxChars,trimmed.length);
      if(end<trimmed.length){const newline=trimmed.lastIndexOf('\n',end);if(newline>i+maxChars/2)end=newline;}
      result.push({section:block.section,text:trimmed.slice(i,end)});if(end===trimmed.length)break;i=Math.max(i+1,end-overlap);
    }
  }
  return result;
}

async function extract(drive,file) {
  if(Number(file.size)>15*1024*1024)throw Error('ARCHIVO_MUY_GRANDE');
  if(file.mimeType==='application/vnd.google-apps.document')return String((await drive.files.export({fileId:file.id,mimeType:'text/plain'},options)).data);
  if(file.mimeType==='application/vnd.google-apps.spreadsheet')return String((await drive.files.export({fileId:file.id,mimeType:'text/csv'},options)).data);
  const {data}=await drive.files.get({fileId:file.id,alt:'media'},{...options,responseType:'arraybuffer'});
  const buffer=Buffer.from(data);
  if(file.mimeType==='application/pdf'){
    return extractPdfText(buffer);
  }
  if(file.mimeType.includes('wordprocessingml')){const mammoth=await import('mammoth');return (await mammoth.extractRawText({buffer})).value;}
  return buffer.toString('utf8');
}
export async function extractPdfText(buffer){
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs'),loading=getDocument({data:new Uint8Array(buffer),useSystemFonts:true,isEvalSupported:false}),doc=await loading.promise;
  try{const pages=[];for(let p=1;p<=doc.numPages;p++){const page=await doc.getPage(p);pages.push((await page.getTextContent()).items.map(i=>i.str+(i.hasEOL?'\n':' ')).join(''));}return pages.join('\n\n');}finally{await loading.destroy();}
}

export async function inventory(drive,folder) {
  const root=(await drive.files.get({fileId:folder,fields:'id,mimeType,trashed'},options)).data;
  if(root.trashed||root.mimeType!==FOLDER)throw Error('CARPETA_INVALIDA');
  const files=new Map(),folders=new Set([folder]),queue=[folder];
  while(queue.length){const parent=queue.shift();let pageToken;
    do {const {data}=await drive.files.list({q:`'${parent}' in parents and trashed=false`,fields:`nextPageToken,files(${fields})`,pageSize:100,pageToken,supportsAllDrives:true,includeItemsFromAllDrives:true},options);
      for(const f of data.files||[]){if(f.mimeType===FOLDER){if(!folders.has(f.id)){folders.add(f.id);queue.push(f.id);}}else files.set(f.id,f);}
      pageToken=data.nextPageToken;
    }while(pageToken);
  }
  return files;
}

export function createDriveClient(){return google.drive({version:'v3',auth:new google.auth.GoogleAuth({scopes:['https://www.googleapis.com/auth/drive.readonly']})});}
export function isApproved(file,manifest){return Boolean(file.description?.includes('APROBADO_RRHH')||(manifest?.archivos?.[file.id]?.version===String(file.version)));}
export async function syncDrive(db,{folderId=config.DRIVE_FOLDER_ID,trigger='manual',driveClient,embedImpl=embed,approvalManifestPath=config.DEMO_APPROVAL_MANIFEST}={}) {
  if(!folderId||!/^[\w-]+$/.test(folderId))throw Error('Falta DRIVE_FOLDER_ID válido');
  const drive=driveClient||createDriveClient();
  let manifest=null;
  if(config.NODE_ENV==='development'&&approvalManifestPath){manifest=JSON.parse(await readFile(approvalManifestPath,'utf8'));if(manifest.carpeta_id!==folderId||manifest.autorizado!==true)throw Error('MANIFIESTO_DEMO_INVALIDO');}
  const c=await db.connect();const result={nuevos:0,actualizados:0,retirados:0,errores:[],omitidos:[],sincronizado_en:null};
  try {
    await c.query('BEGIN');
    await c.query('INSERT INTO drive_estado(carpeta_id) VALUES($1) ON DUPLICATE KEY UPDATE carpeta_id=VALUES(carpeta_id)',[folderId]);
    const state=(await c.query('SELECT * FROM drive_estado WHERE carpeta_id=$1 FOR UPDATE',[folderId])).rows[0];
    let token=state.page_token;
    if(!token)token=(await drive.changes.getStartPageToken({},options)).data.startPageToken;
    // Se captura el token antes del barrido; cada ejecución reconcilia el alcance completo.
    let files;
    try{files=await inventory(drive,folderId);}catch(error){
      // Un 404 verificado del alcance retira el acceso; errores transitorios revierten todo.
      if(error.response?.status!==404&&error.code!==404)throw error;
      const old=(await c.query('SELECT id FROM documentos WHERE carpeta_id=$1 AND aprobado=1',[folderId])).rows;
      await c.query("UPDATE documentos SET aprobado=0,estado='retirado' WHERE carpeta_id=$1",[folderId]);
      result.retirados=old.length;result.errores.push({id:folderId,error:'CARPETA_NO_ACCESIBLE'});result.sincronizado_en=new Date().toISOString();
      await c.query('UPDATE drive_estado SET ultimo_intento=UTC_TIMESTAMP(),resultado=$1 WHERE carpeta_id=$2',[JSON.stringify(result),folderId]);await c.query('COMMIT');return result;
    }
    let nextToken=token,pageToken=token;
    try {
      do {const {data}=await drive.changes.list({pageToken,pageSize:100,fields:'nextPageToken,newStartPageToken,changes(fileId,removed)',includeRemoved:true,supportsAllDrives:true,includeItemsFromAllDrives:true},options);
        // Los cambios disparan una nueva reconciliación: parents/directorio decide alcance.
        if(data.changes?.length)files=await inventory(drive,folderId);
        pageToken=data.nextPageToken;nextToken=data.newStartPageToken||nextToken;
      }while(pageToken);
    }catch(error){if(error.code!==410&&error.response?.status!==410)throw error;nextToken=(await drive.changes.getStartPageToken({},options)).data.startPageToken;files=await inventory(drive,folderId);}
    const indexed=(await c.query('SELECT id,modificado,version,aprobado,hash_contenido FROM documentos WHERE carpeta_id=$1',[folderId])).rows;
    const byId=new Map(indexed.map(d=>[d.id,d]));
    for(const old of indexed){const current=files.get(old.id);if(!current||!isApproved(current,manifest)){await c.query("UPDATE documentos SET aprobado=0,estado='retirado' WHERE id=$1",[old.id]);if(old.aprobado)result.retirados++;}}
    for(const file of files.values()) {
      if(!isApproved(file,manifest)){result.omitidos.push({id:file.id,nombre:file.name,motivo:'FALTA_APROBACION_RRHH',enlace:file.webViewLink});continue;}
      const old=byId.get(file.id);
      if(!supported.has(file.mimeType)){result.errores.push({id:file.id,error:'TIPO_NO_SOPORTADO'});continue;}
      if(old?.aprobado&&String(old.version)===String(file.version))continue;
      let stage='extraccion';
      try {
        await c.query('SAVEPOINT documento_actual');
        if(!/^https:\/\/(docs\.google\.com|drive\.google\.com)\//.test(file.webViewLink||''))throw Error('ENLACE_INVALIDO');
        const text=await extract(drive,file),chunks=chunkDocument(text);if(!chunks.length)throw Error('DOCUMENTO_VACIO');
        const hash=createHash('sha256').update(text).digest('hex'),vectors=[];stage='embeddings';
        const batch=embedImpl===embed?await embedMany(chunks.map(chunk=>chunk.text),'document'):await Promise.all(chunks.map(chunk=>embedImpl(chunk.text,'document')));
        for(const vector of batch){const v=typeof vector==='string'?JSON.parse(vector):vector;if(v.length!==1024||!v.every(Number.isFinite))throw Error('EMBEDDING_INVALIDO');vectors.push(JSON.stringify(v));}
        // Verificación final de versión y acceso antes de publicar.
        stage='verificacion';const latest=(await drive.files.get({fileId:file.id,fields},options)).data;
        if(latest.trashed||String(latest.version)!==String(file.version)||!isApproved(latest,manifest))throw Error('DOCUMENTO_CAMBIO_DURANTE_INGESTA');
        const desc=file.description||'',since=desc.match(/vigente_desde\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i)?.[1]||manifest?.archivos?.[file.id]?.vigente_desde||null,until=desc.match(/vigente_hasta\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i)?.[1]||manifest?.archivos?.[file.id]?.vigente_hasta||null;
        stage='persistencia';await c.query("INSERT INTO documentos(id,nombre,version,vigencia,enlace,modificado,aprobado,carpeta_id,estado,hash_contenido,mime_type,vigente_desde,vigente_hasta) VALUES($1,$2,$3,$4,$5,$6,1,$7,'vigente',$8,$9,$10,$11) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),version=VALUES(version),vigencia=VALUES(vigencia),enlace=VALUES(enlace),modificado=VALUES(modificado),aprobado=1,carpeta_id=VALUES(carpeta_id),estado='vigente',hash_contenido=VALUES(hash_contenido),mime_type=VALUES(mime_type),vigente_desde=VALUES(vigente_desde),vigente_hasta=VALUES(vigente_hasta)",[file.id,file.name,String(file.version),since?`${since}${until?' a '+until:''}`:'Consultar fuente',file.webViewLink,new Date(file.modifiedTime),folderId,hash,file.mimeType,since,until]);
        await c.query('UPDATE documentos SET version_politica=$1 WHERE id=$2',[policyVersion(text),file.id]);
        await c.query('DELETE FROM fragmentos WHERE documento_id=$1',[file.id]);
        for(let i=0;i<chunks.length;i++)await c.query('INSERT INTO fragmentos(documento_id,seccion,contenido,embedding,orden,modelo_embedding,dimension) VALUES($1,$2,$3,$4,$5,$6,1024)',[file.id,chunks[i].section,chunks[i].text,vectors[i],i,config.VOYAGE_MODEL]);
        if(old)result.actualizados++;else result.nuevos++;
        await c.query('RELEASE SAVEPOINT documento_actual');
      }catch(error){await c.query('ROLLBACK TO SAVEPOINT documento_actual');await c.query('RELEASE SAVEPOINT documento_actual');result.errores.push({id:file.id,error:error.response?.status===403||error.response?.status===404?'SIN_ACCESO':'INGESTA_FALLIDA',etapa:stage,codigo:String(error.original?.code||error.code||error.message?.match(/\b[45]\d\d\b/)?.[0]||error.name)});if(error.response?.status===404)await c.query("UPDATE documentos SET aprobado=0,estado='retirado' WHERE id=$1",[file.id]);}
    }
    result.sincronizado_en=new Date().toISOString();
    await c.query('UPDATE drive_estado SET page_token=$1,ultimo_intento=UTC_TIMESTAMP(),ultimo_exito=CASE WHEN $2=0 THEN UTC_TIMESTAMP() ELSE ultimo_exito END,resultado=$3 WHERE carpeta_id=$4',[result.errores.length?token:nextToken,result.errores.length,JSON.stringify(result),folderId]);
    await c.query('INSERT INTO sincronizaciones(resultado) VALUES($1)',[JSON.stringify({disparador:trigger,...result})]);
    await c.query('COMMIT');return result;
  } catch(error){await c.query('ROLLBACK');await db.query('INSERT INTO sincronizaciones(resultado) VALUES($1)',[JSON.stringify({disparador:trigger,carpeta_id:folderId,estado:'fallida',error:'ERROR_SINCRONIZACION'})]);throw error;}finally{c.release();}
}
