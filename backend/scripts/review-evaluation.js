import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'csv-parse/sync';
const root=new URL('../../docs/resultados/',import.meta.url),reviewFile=process.argv[2];
if(!reviewFile)throw Error('Indicá un JSON de revisión con decisiones y motivos por ID');
const review=JSON.parse(await readFile(reviewFile,'utf8')),rows=parse(await readFile(new URL('banco_45_ejecutado.csv',root),'utf8'),{columns:true,bom:true});
if(rows.length!==45||Object.keys(review.decisiones||{}).length!==45||!review.revisor)throw Error('Revisión incompleta');
for(const row of rows){const d=review.decisiones[row.id];if(typeof d?.correcta!=='boolean'||!d.motivo||!row.respuesta_obtenida||row.latencia_ms==='')throw Error('Falta evidencia o decisión para pregunta '+row.id);row.correcta=d.correcta?'Si':'No';row.estado='Revisada';}
review.revisado_en=new Date().toISOString();
const fields=Object.keys(rows[0]),csv=v=>'"'+String(v??'').replaceAll('"','""')+'"',content=fields.map(csv).join(',')+'\n'+rows.map(r=>fields.map(k=>csv(r[k])).join(',')).join('\n')+'\n';
const metadata=JSON.parse(await readFile(new URL('condiciones.json',root),'utf8'));metadata.estado='ejecutada_revisada';metadata.revisor=review.revisor;
const folders=[root];if(/^evaluacion-[\dTZ-]+$/.test(metadata.archivo_historico))folders.push(new URL(metadata.archivo_historico+'/',root));
for(const folder of folders){await writeFile(new URL('banco_45_ejecutado.csv',folder),content);await writeFile(new URL('revision.json',folder),JSON.stringify(review,null,2));await writeFile(new URL('condiciones.json',folder),JSON.stringify(metadata,null,2));}
console.log('45 filas revisadas, con decisiones y motivos conservados.');
