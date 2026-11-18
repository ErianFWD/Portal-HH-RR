import {addDays} from './time.js';
const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
export function dateRangeFromQuestion(question){
  const s=question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const iso=s.match(/(\d{4}-\d{2}-\d{2})\s+(?:al|a|hasta)\s+(\d{4}-\d{2}-\d{2})/);
  if(iso)return {inicio:iso[1],fin:iso[2]};
  const range=s.match(/\bdel?\s+(\d{1,2})\s+al\s+(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if(!range||!months.includes(range[3]))return null;
  const prefix=range[4]+'-'+String(months.indexOf(range[3])+1).padStart(2,'0')+'-';
  return {inicio:prefix+range[1].padStart(2,'0'),fin:prefix+range[2].padStart(2,'0')};
}
export async function businessDays(db,start,end){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||new Date(start+'T12:00:00Z').toISOString().slice(0,10)!==start||new Date(end+'T12:00:00Z').toISOString().slice(0,10)!==end||end<start||(Date.parse(end)-Date.parse(start))/86400000>366)throw Error('RANGO_INVALIDO');
  const holidays=new Set((await db.query('SELECT fecha FROM feriados WHERE fecha BETWEEN $1 AND $2',[start,end])).rows.map(r=>String(r.fecha).slice(0,10)));
  let count=0;for(let date=start;date<=end;date=addDays(date,1)){const weekday=new Date(date+'T12:00:00Z').getUTCDay();if(weekday!==0&&weekday!==6&&!holidays.has(date))count++;}
  return count;
}
