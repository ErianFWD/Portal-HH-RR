// La rama de datos ya resuelve el dato propio; evita una abstención contradictoria
// de la rama normativa. No cambia reglas ni cifras provenientes de las fuentes.
export function policyPartOnly(text){
  return String(text).split(/(?<=[.!?])\s+/u).filter(sentence=>{
    const s=sentence.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const lacksData=/no (?:hay evidencia|puedo|podemos|se puede|cuento con)/.test(s);
    const aboutOwnValue=/(?:saldo|cuantos dias te quedan|dias disponibles)/.test(s);
    return !(lacksData&&aboutOwnValue&&/determinar|conocer|indicar|calcular|consultar/.test(s));
  }).join(' ').trim();
}
