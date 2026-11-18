const normalize=q=>q.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
export function requiresDenial(q,user={rol:'colaborador'}) {
  const s=normalize(q);
  if(/\b(salario|sueldo|saldo|vacaciones|expediente|datos)\b/.test(s)&&/\b(companer[oa]|juan|gerente|otra persona|otros|ajenos|todos|jef[ea]|colega)\b/.test(s))return true;
  if(user.rol!=='rrhh'&&/dashboard|reporte|saldos de todos|personas estan|personas hay|listado/.test(s))return true;
  return /ignor[aá].*permisos|soy administrador|cambia.*rol|sql\b.*select/.test(s);
}
export function classify(q){
  const s=normalize(q);if(requiresDenial(q))return 'restricted';
  const personal=/\b(mi|mis|me|mio|mia|propio|propia)\b/.test(s)&&/quedan|disponible|saldo|proxim.*pago|evaluacion|estado.*solicitud/.test(s);
  const policy=/politica|acumul|reglamento|norma|permiso|incapaci|jornada|beneficio|vacacion|sobren|pasar.*ano|feriado|aguinaldo|preaviso|licencia|teletrabaj|horas extra|seguro|acoso|horario|capacitacion|solidarista|cumpleanos|bono|periodo de prueba|liquidacion|renunci|despid|duelo|diagnostico|marca de asistencia|estudio|matrimonio/.test(s);
  const explicitRule=/puedo|acumul|pasar.*ano|sobren|politica|norma|reglamento|corresponden|pierdo|caduc/.test(s);
  return personal&&policy&&explicitRule?'mixed':personal?'personal':policy?'policy':'out';
}
