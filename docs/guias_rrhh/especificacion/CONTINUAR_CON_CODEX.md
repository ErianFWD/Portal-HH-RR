# Especificación para continuar el portal de RRHH

## Autoridad y estado

El enunciado Mini Proyecto 2 es la especificación académica. Este paquete concreta reglas del escenario, contenido para RAG y contratos de implementación. No acredita que el software actual esté terminado. Inspeccionar el repositorio antes de modificarlo y conservar lo que funcione. No se han ejecutado pruebas contra su backend ni contra sus cuentas de proveedores.

Empresa ficticia: Servicios del Pacífico S.A. Sector: servicios administrativos. País: Costa Rica. Personal mínimo: 50 personas simuladas. Idioma: español. Zona: America/Costa_Rica. Moneda: CRC. Fecha de referencia reproducible para pruebas: 2026-11-17. En ejecución real usar reloj del servidor y mantener tests con reloj inyectable. No implementar varias empresas, cobros o planes como requisito de este mini proyecto.

## Fuentes de verdad

RAG: políticas, condiciones internas y procedimientos. SQL: identidades, saldos, solicitudes, pagos, evaluaciones y cifras de reportes. El modelo no genera ni ejecuta SQL libre. Cada herramienta utiliza parámetros y la identidad validada por el backend. El prompt no otorga permisos.

Los diez archivos POL-01 a POL-10 contienen reglas del caso ficticio. Las fuentes S01 a S13 documentan las afirmaciones legales y se resuelven en fuentes_oficiales.json. Una regla interna más favorable se etiqueta como ficticia, no como obligación nacional. No completar vacíos normativos con conocimiento supuesto del modelo.

## Matriz de acceso

Colaborador: ver políticas generales, sus saldos, sus solicitudes, sus próximas fechas de pago y evaluación. No ver compañeros, salarios ajenos, expedientes, dashboard o reportes. RRHH: ver reportes, solicitudes y operaciones de datos autorizadas por su función. El rol no autoriza cualquier columna de cualquier tabla. Denuncias y diagnósticos quedan fuera del corpus general y de prompts del asistente.

La identidad se deriva de sesión/JWT verificado y se vincula al colaborador activo. Ignorar identidades arbitrarias del cuerpo de la petición. Aplicar la comprobación también al historial y a las fuentes. Herramientas de colaboradores deben recibir el contexto confiable por argumento interno, nunca usar un ID sugerido por el modelo.

## Contratos de los agentes

Orquestador: entrada {pregunta, usuario_autenticado, fecha_local, historial_autorizado}. Clasificar con LLM a politica, dato_personal, mixta, reporte, restringida o fuera_alcance. Salida {intencion, destinos, consulta_reformulada}; el resultado se valida con esquema y se pasa a un despachador con lista permitida. Preguntas mixtas llaman a políticas y datos. Solo el orquestador entrega la respuesta final al usuario.

Políticas: entrada {consulta, fecha_local}. Herramienta buscar_politicas. Salida {respuesta, citas, suficiente, motivo}. Cada cita incluye documento_id, fragmento_id, titulo, seccion, version y drive_url. No posee herramientas de datos personales. Si no hay evidencia suficiente responde con abstención, no rellena datos.

Datos: entrada {consulta, contexto_autorizacion}. Herramientas saldo_propio, solicitudes_propias, proximo_pago, proxima_evaluacion y, para RRHH, ausencias_agregadas. Salida {datos, procedencia, fecha_consulta}. No inventa ni interpreta políticas. Debe resolver fechas relativas con el reloj local; si una solicitud es ambigua, pedir precisión.

Analista: entrada {fecha_reporte, zona}. SQL produce un JSON inmutable de métricas y procedencia. El LLM recibe ese JSON y redacta de 3 a 5 frases. Validar números y afirmaciones de tendencia contra el JSON. Si la validación falla, regenerar con límite o guardar resumen de plantilla marcado como tal. Guardar estado y error. Una restricción única por fecha evita duplicados. Un disparo manual para demostración reutiliza la misma lógica y conserva auditoría.

Ingesta: entrada {carpeta_id, disparador}. Solo este módulo usa credenciales de Drive. Salida {nuevos, actualizados, retirados, errores, sincronizado_en}. Capturar startPageToken antes del barrido inicial, paginar, procesar cambios y guardar newStartPageToken solo después del procesamiento duradero. changes.list no sustituye la verificación del alcance de carpeta y sus descendientes. Resolver eliminaciones y pérdida de acceso mediante cambios y reconciliación. No purgar el corpus completo ante un fallo transitorio.

## Modelo de datos mínimo ampliado

usuarios: id, colaborador_id único, correo único, hash_clave, rol, activo. colaboradores: id, nombre ficticio, departamento, puesto, fecha_ingreso, fecha_salida nullable, jefe_id, estado. Evitar contradicción entre rol en identidad y rol operativo; definir una fuente autorizada.

saldos_vacaciones: colaborador_id, periodo_inicio, periodo_fin, dias_asignados, dias_tomados, dias_disponibles, actualizado_en. No duplicar saldo entre periodos superpuestos. Mantener dias_disponibles = asignados - tomados + ajustes registrados. No acumular automáticamente 15 días por año calendario cuando la política define ciclos de 50 semanas.

solicitudes: id, colaborador_id, tipo, fecha_inicio, fecha_fin, estado, aprobador_id, creada_en, resuelta_en. Estados pendiente, aprobada, rechazada, cancelada. Días hábiles excluyen fines de semana y feriados para el horario definido. Las incapacidades cuentan días calendario según su registro.

incapacidades: id, colaborador_id, entidad, tipo_administrativo, fecha_inicio, fecha_fin, referencia_simulada. No incluir diagnóstico. movimientos_personal: id, colaborador_id, tipo, fecha, motivo_simulado. evaluaciones: id, colaborador_id, fecha_programada, estado. calendario_pagos: id, fecha_nominal, fecha_pago, tipo, grupo_planilla. feriados: fecha, nombre, clasificacion, fuente.

documentos: id, drive_file_id único, titulo, version, vigente_desde, vigente_hasta, estado, url, modified_time_indexado, hash_contenido. fragmentos: id, documento_id, seccion, pagina nullable, orden, texto, embedding, modelo_embedding, dimension. sesiones_conversacion y mensajes: identidad, timestamps, pregunta, respuesta, citas y estado. consultas_chat: consulta_id, colaborador_id, intencion, resuelta, escalada, latencia_total_ms, fecha. intervenciones_agente: consulta_id, agente, duracion_ms, fragmentos, error y escalamiento. Registrar una consulta una sola vez aunque tenga varios agentes.

reportes_diarios: id, fecha única, zona, datos_json, resumen_texto, estado, generado_en y version_metodo. Campos numéricos de reportes se obtienen de SQL, no se extraen del texto del LLM. No incluir archivos JSON de claves ni valores secretos en ningún seed.

## Métricas y reglas del reporte

Ausente hoy: colaborador activo con solicitud aprobada de vacaciones o permiso que cubra la fecha, o incapacidad que la cubra. Contar personas distintas. Si hay registros incompatibles, generar incidencia de calidad; no contar dos veces. Desglose por departamento y tipo, documentando precedencia incapacidad, vacaciones y permiso solo para visualización.

Pendientes: estado pendiente a las 07:00 locales de la fecha de reporte. Más de tres días: antigüedad estrictamente mayor a 72 horas calendario al corte; explicitar esta decisión interna. Para históricos, guardar resuelta_en y reconstruir el estado al corte o conservar la instantánea diaria.

Incapacidades: número de personas activas y suma de días calendario de intersección con el mes hasta la fecha de corte, unificando periodos superpuestos por persona. No sumar duración completa de una boleta que cruza meses.

Rotación acumulada del mes: 100 * salidas_mes / ((personal_inicio_mes + personal_al_corte)/2). Si el denominador es cero, resultado nulo y etiqueta sin base, no cero. Es una convención del proyecto, no una fórmula legal. Conservar entradas y salidas por separado.

Vacaciones en riesgo: colaboradores activos cuyo saldo consolidado disponible sea estrictamente mayor a 20 días. Es una alerta de planificación, no una valoración monetaria del pasivo ni autorización de pérdida de días.

Chat de ayer: intervalo [00:00 de ayer, 00:00 de hoy) en America/Costa_Rica. Porcentaje resuelto sin escalar = consultas resueltas y no escaladas / consultas completadas * 100. Denominador cero produce nulo y sin consultas. Mostrar fallidas y canceladas aparte. Latencia promedio y p90 usan una medición por pregunta completa; registrar también tiempo al primer texto si existe streaming. Top temas por taxonomía fija, no por agrupar frases arbitrarias generadas. Dudas no resueltas deben anonimizarse.

Dashboard: 4 indicadores mínimos, 2 gráficos con uno de 30 días, tabla de solicitudes pendientes, resumen e historial. Sembrar datos de tres meses para calcular tendencia histórica con SQL; no inventar reportes como si el scheduler los hubiera producido. Programar 07:00 America/Costa_Rica, bloqueo por fecha y mecanismo de recuperación tras reinicio.

## Ingesta, recuperación y citas

Subir solo una representación por política al corpus definitivo. Los PDF y Markdown del paquete son versiones equivalentes, no veinte políticas. Importar CSV como Google Sheets y abrir al menos un editable como Google Docs. Sustituir IDs y URLs nulos de catalogo.json con valores reales después de subir. No fabricar enlaces de Drive.

En el código actual DRIVE_FILE_ID parece referirse a una prueba de un solo Google Doc. Esa prueba no satisface aún la carpeta con 10 documentos ni la sincronización requerida. Inspeccionar código y configurar el identificador de carpeta que realmente utilice la aplicación. Si no existe, implementarlo y actualizar .env.example sin secretos.

Usar fragmentos por encabezados y comparar tamaños, con punto de partida de 500 a 1000 tokens y solapamiento. Algunos documentos pequeños caben en un fragmento. Preservar relaciones de tablas. Recuperar con modelo y dimensión idénticos a la indexación. Validar suficiencia con el banco de preguntas, no fijar un umbral universal sin medición. No usar el score como probabilidad de verdad.

Calcular nuevos embeddings antes de reemplazar el índice anterior. Actualizar de forma atómica en una misma conexión de PostgreSQL. Versionar política e impedir respuestas que mezclen versiones incompatibles. Retirar eliminaciones de nuevas búsquedas, manteniendo referencias históricas autorizadas según retención. Ante falla no marcar un documento vacío como indexado. Citas visibles deben provenir del contexto real y abrir una fuente autorizada.

## Endpoints orientativos

Adaptar nombres al repositorio. POST /auth/login, POST /auth/logout, GET /me, POST /chat, GET /conversaciones, GET /conversaciones/:id/mensajes, GET /me/vacaciones, GET /me/solicitudes, GET /me/evaluaciones, GET /me/proximo-pago. Solo RRHH: GET /rrhh/reportes, GET /rrhh/reportes/:fecha, POST /rrhh/reportes/generar y POST /rrhh/drive/sincronizar. Para una primera entrega, el envío de solicitudes y tickets puede permanecer fuera de alcance; no simular confirmaciones.

## Criterios de avance

Primero ejecutar una política real desde Drive y saldo propio desde SQL, luego consulta mixta y denegación de terceros. Después completar ingesta, reportes, dashboard y evaluación. Medir las 45 preguntas con rol y fecha controlados. Objetivo 36/45 y comprobar al menos 20/25 de base por separado; seguridad de preguntas 21 y 22 es obligatoria. El p90 de respuesta completa debe ser menor que 8000 ms en la muestra definida, declarando concurrencia, modelo y condiciones. Ninguna fila de evaluación está marcada como aprobada antes de ejecutarse.

El informe técnico final y sus mediciones se completan con evidencia del código real. Este documento no inventa arquitectura desplegada, costos ni resultados.
