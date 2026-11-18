import {readFile,writeFile} from 'node:fs/promises';
import {config} from '../server/config.js';
import {inventory,createDriveClient} from '../server/ingestion.js';
if(config.NODE_ENV!=='development'||!process.argv.includes('--approve'))throw Error('Solo demo de desarrollo y autorización explícita con --approve');
const catalog=JSON.parse(await readFile(new URL('../../docs/paquete_rrhh/Documentacion_RRHH/politicas/catalogo.json',import.meta.url),'utf8'));
const allowed=new Map(catalog.map(d=>[d.drive_file_id,{vigente_desde:d.vigente_desde,vigente_hasta:null}]));
allowed.set('1sa9-cEfQNI_jZfBBqZk5WRD6d6Nk75sP',{vigente_desde:'2026-01-01',vigente_hasta:'2026-12-31'});
allowed.set('1eD-jMQswJx1QIcpE5ZXWG4_jMvt1J6ml',{vigente_desde:'2026-01-01',vigente_hasta:'2026-12-31'});
const files=await inventory(createDriveClient(),config.DRIVE_FOLDER_ID),archivos={};
for(const [id,dates] of allowed){const file=files.get(id);if(!file)throw Error('Falta un archivo esperado: '+id);archivos[id]={nombre:file.name,version:String(file.version),enlace:file.webViewLink,...dates};}
const manifest={autorizado:true,alcance:'Demo académico ficticio; no acredita aprobación empresarial real',autorizacion:'Usuario autorizó expresamente estos diez documentos y dos calendarios para Voyage y DeepSeek en el chat el 2026-11-18.',carpeta_id:config.DRIVE_FOLDER_ID,registrado_en:new Date().toISOString(),destinos:['Voyage embeddings','DeepSeek respuestas'],archivos};
await writeFile(new URL('../../docs/resultados/autorizacion_demo.json',import.meta.url),JSON.stringify(manifest,null,2));
console.log('Autorización de demo registrada para '+Object.keys(archivos).length+' versiones concretas; Drive no fue modificado.');
