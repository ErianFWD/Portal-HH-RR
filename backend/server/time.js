export const ZONE='America/Costa_Rica';
export function localDate(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function addDays(date,days){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function utcCutoff(date,hour=7){return `${date} ${String(hour+6).padStart(2,'0')}:00:00`;}
export function localHour(now=new Date()){return Number(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,hour:'2-digit',hourCycle:'h23'}).format(now));}
export function dateOnly(value){return value instanceof Date?value.toISOString().slice(0,10):String(value).slice(0,10);}
export function parseJson(value,fallback=null){if(value===null||value===undefined)return fallback;if(typeof value==='string'){try{return JSON.parse(value)}catch{return fallback}}return value;}
export function nextFriday(date){const d=new Date(date+'T12:00:00Z');const diff=(5-d.getUTCDay()+7)%7;return addDays(date,diff);}
