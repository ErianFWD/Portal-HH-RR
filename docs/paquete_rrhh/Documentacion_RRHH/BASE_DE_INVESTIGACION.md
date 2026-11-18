# Base investigada para las políticas

## Alcance y método

El escenario corresponde a una empresa privada ficticia de servicios administrativos de Costa Rica, con salario mensual y jornada de lunes a viernes. Se eligieron condiciones internas explícitas para que el RAG tenga respuestas comprobables. Se consultaron fuentes oficiales del MTSS, PGR, CCSS e Imprenta Nacional al 17 de noviembre de 2026. Las fuentes se identifican en cada documento y en fuentes_oficiales.json. Las normas particulares y sus reformas prevalecen sobre una generalización del chatbot.

Este archivo constituye notas de investigación para la implementación, no el informe académico desarrollado de 6 a 10 páginas. El informe del equipo debe ampliar el contexto, metodología, análisis por dominio, diferencias entre beneficios y mínimos legales y referencias. No atribuir a una empresa real estos beneficios o contactos.

## Hallazgos aplicados

Vacaciones: la política toma como referencia el mínimo del artículo 153 y define un beneficio interno de 15 días hábiles por ciclo de 50 semanas para una jornada de cinco días. El caso no transforma automáticamente dos semanas legales en un número fijo universal de días. La acumulación no se interpreta como autorización indefinida ni caducidad automática. Debe revisarse bajo reglas legales de disfrute.

Permisos: el artículo 95 establece licencias ordinarias y situaciones especiales. La licencia por duelo ya tiene regulación legal desde la Ley 10589; no debe tratarse como un beneficio puramente voluntario. La mejora interna de duelo se separa de ese mínimo. Matrimonio y estudio del paquete son beneficios ficticios específicos.

Incapacidades: separar obligación patronal inicial, subsidio de CCSS, riesgos del trabajo y licencias. El criterio MTSS utilizado para los tres primeros días es anterior a la fecha del laboratorio; se usa para el caso ordinario junto con información institucional de CCSS y se declaran excepciones. No constituye un motor completo de planilla. Las bases pueden diferir y las incapacidades sucesivas requieren comprobación institucional.

Jornada: la empresa define 40 horas semanales efectivas; no usa el máximo legal como obligación de trabajar ese máximo. El tratamiento de horas extra se apoya en artículo 139. La desconexión se respalda en la reforma legal de teletrabajo. La compatibilidad de un puesto debe constar y no inferirse del nombre del empleado.

Remuneración: el aguinaldo utiliza la regla publicada por MTSS; el calendario de depósitos es una decisión interna. Los feriados de 2026 provienen de la circular oficial. La clasificación no obligatorio no equivale a descontar esos días a una persona con salario mensual. Las tasas tributarias y sociales se omiten porque un cálculo individual requiere tablas y bases vigentes.

Beneficios: capacitación y cumpleaños se presentan como reglas originales ficticias. La ausencia de seguro privado o asociación evita que el modelo invente servicios. La falta de un beneficio en los documentos solo permite decir que no se encontró, no demostrar que nunca podría existir fuera del corpus.

Ingreso y salida: distinguir revisión de adaptación y efectos legales según contrato. El preaviso usa tramos de antigüedad; la cesantía no se reduce a un porcentaje fijo. Fueros y derechos protegidos no desaparecen por antigüedad corta.

Desempeño: fechas y proceso son decisiones internas simuladas. La fecha individual se guarda en SQL y prevalece para consultas personales. Las evaluaciones no se usan como decisiones automatizadas de despido o promoción.

Conducta: el protocolo diferencia denuncia confidencial de anonimato absoluto y protege las vías externas. El paquete define canales .example no operativos; una aplicación no debe afirmar que envió una denuncia a esos contactos. El procedimiento legal específico no se sustituye por instrucciones del modelo.

Privacidad: la Ley 8968 exige considerar datos sensibles y finalidad. El ejercicio prohíbe datos personales reales. Los periodos de retención propuestos son decisiones del laboratorio, no plazos legales universales. Mantener expedientes y diagnósticos fuera del índice general y minimizar resultados enviados al proveedor de IA.

## Pendientes de la entrega académica

Desarrollar el informe de investigación de 6 a 10 páginas con autoría del equipo. Conservar capturas o metadatos de fuentes y fecha de revisión. Completar el informe técnico de 8 a 12 páginas solo después de implementar, medir calidad, latencia y documentar limitaciones reales. No inventar resultados, costos, aprobaciones de RRHH ni enlaces de Drive.
