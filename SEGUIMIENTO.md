# Seguimiento de la guía de RRHH

Revisión: 18 de noviembre de 2026. Se conservaron los cambios previos del repositorio. Las marcas indican evidencia de implementación o ejecución; las pruebas simuladas de proveedores se distinguen de los servicios reales.

## Implementado y verificado localmente

- [x] Migraciones 001 y 002 aplicadas contra MySQL real; 251 colaboradores ficticios conservados.
- [x] Fixture con saldo 12, solicitud del 20-11-2026 y evaluación del 15-12-2026; importación idempotente de historia de septiembre, octubre y noviembre y calendarios.
- [x] Sesión persistida con hash; identidades y roles validados en servidor; rechazo de usuarios y colaboradores inactivos.
- [x] Herramientas de saldo, solicitudes, próximo pago y evaluación propias; cálculo de días hábiles con feriados SQL.
- [x] Clasificador LLM con esquema, destinos permitidos, denegaciones preventivas y reglas de respaldo; preguntas mixtas llaman a datos y políticas.
- [x] Registro único por pregunta con intención, tema, estado, respuesta, fuentes, resultado y latencia total; errores de agentes auditados.
- [x] Historial persistido y privado. Conversaciones ajenas devuelven 404. Fuentes retiradas se ocultan y se señala la respuesta histórica afectada.
- [x] Analista SQL: ausencias distintas, precedencia visual, pendientes al corte, antigüedad >72 horas, días de incapacidad sin duplicar, rotación con nulos y chat de ayer en Costa Rica.
- [x] Resumen LLM con validación numérica, rechazo de tendencias no sustentadas, dos intentos y plantilla marcada al fallar.
- [x] Reporte por fecha con bloqueo transaccional, auditoría manual e idempotencia probada con dos ejecuciones simultáneas.
- [x] Scheduler de 07:00 Costa Rica y recuperación limitada a treinta fechas al reiniciar; requiere mantener API encendida.
- [x] Dashboard exclusivo RRHH: indicadores, dos gráficos, serie SQL de treinta días, pendientes, resumen, historial y descarga de procedencia.
- [x] Sincronizador de carpeta y descendientes con paginación, token inicial anterior al barrido, cambios y reconciliación. Embeddings previos al reemplazo, transacción y savepoints; no vacía corpus por fallos transitorios.
- [x] Pruebas con Drive simulado: ingesta, actualización, eliminación, fallos de embeddings y conservación de token e índice.
- [x] Citas validadas contra fragmentos recuperados; filtros de modelo, dimensión y vigencia; abstención cuando no existe evidencia.
- [x] Banco de 45 preguntas incorporado; ejecutor y cálculo de métricas implementados sin aprobar filas automáticamente.
- [x] Compilación del frontend y pruebas unitarias e integrales locales.

## Dependencias concretas pendientes

- [x] Usuario autorizó explícitamente las diez políticas y dos calendarios ficticios para Voyage y DeepSeek el 18-11-2026. El bloqueo inicial de revisión automática quedó resuelto con ese consentimiento.
- [x] Aprobación de demo registrada por ID y versión en `docs/resultados/autorizacion_demo.json`; solo desarrollo. No se atribuye una aprobación empresarial real ni se modifican permisos de Drive.
- [x] Ingesta real: doce archivos, diez políticas y dos calendarios, sin errores ni omitidos. Secciones, vigencia, versión de política 1.0 y enlaces reales conservados. La revisión de Drive se distingue de la versión de política.
- [x] Catálogo con IDs y enlaces reales comprobados por metadatos de Drive; las aprobaciones siguen pendientes.
- [ ] Convertir calendarios CSV a Sheets y abrir un editable como Google Docs requiere escritura autorizada en Drive y permisos de la cuenta.
- La API confirmó `canAddChildren=false` y `canEdit=false` para la carpeta: la cuenta actual es solo de lectura. No se alteraron permisos ni archivos remotos.
- [x] Corrida completa real y revisada: 41/45 (91,1 %), base 22/25, negativas sin fuga en 21 y 22, p90 5028 ms y 45/45 por debajo de 8000 ms. Concurrencia 1, intervalo de llegadas 21 s; medición de entrada al servicio hasta respuesta completa, no ráfaga HTTP.
- [x] Los errores de la muestra (9, 19, 25 y 38) se conservaron como incorrectos. Después se añadieron controles generales para pago propio, composición mixta y agregado RRHH; las pruebas dirigidas 9, 19, 25 y 44 pasaron 4/4. No se sustituyó la puntuación de las 45 por esos resultados posteriores. El error de traslado de condiciones entre beneficios permanece documentado.
- [ ] Verificar visualmente el frontend en un navegador; esta sesión no expone un navegador controlable. La compilación sí se ejecutó.
- [x] Informes PDF: investigación de 8 páginas y técnico de 10, con fuentes, alcance, código, pruebas y límites. Generación y revisión visual de paginación; las cifras de evaluación se incorporan tras revisar la muestra completa. Documentación asistida, sin atribuir autoría humana ficticia ni certificación docente.
- [x] Autorización separada de métricas ficticias agregadas a DeepSeek; resumen diario real validado contra JSON SQL inmutable y conservado con auditoría.
- [x] Coherencia temporal del seed: historia asignada a colaboradores ya ingresados, sin solicitudes o incapacidades anteriores al ingreso; periodos de 350 días. Valores numéricos del fixture y SOL-001 a SOL-003 conservados.

## Límites documentados

La búsqueda coseno es lineal sobre JSON en MySQL. El valor de vacaciones en riesgo corresponde al saldo actual, incluso al recuperar un reporte histórico. Google Sheets exporta la primera pestaña; los PDF deben tener texto. El portal no crea tickets. La retención automática y las pruebas de carga de despliegue quedan fuera de la validación actual.

## Flujos de vacaciones y asistencia — 18-11-2026

- [x] Migración aditiva e idempotente 003 ejecutada en el demo local. Nuevas tablas de movimientos de vacaciones, auditoría de solicitudes, asistencia, correcciones, horarios versionados, idempotencia y cobertura de feriados. Claves foráneas, índices y unicidad de jornada abierta en MySQL; sin reinicializar datos.
- [x] Regla documentada: `dias = dias_asignados - dias_tomados + ajustes`. Migración conserva saldo histórico, reconcilia ajustes y registra apertura. Pendientes reservan; aprobar descuenta y libera en una transacción; cancelar/rechazar solo libera. Aprobadas históricas no se vuelven a descontar. Seeds adaptados para componentes, reservas y movimientos.
- [x] Mis solicitudes: saldo confirmado/reservado/disponible, vista previa de hábiles, mensaje, creación, historial, respuesta y cancelación propia. Conflictos con pendientes, aprobadas e incapacidades; saldo requerido; fechas desde hoy y cobertura explícita por año.
- [x] Gestionar solicitudes: filtros por persona/departamento/estado/fechas, detalle y disponibilidad, respuesta, resolución auditada, rechazo con motivo y prohibición de autoaprobación. Permisos/licencias no descuentan vacaciones.
- [x] Mis datos y agente employee distinguen saldo confirmado de disponibilidad; solicitudes aprobadas usan las ausencias SQL existentes. No se regeneran reportes guardados al resolver.
- [x] Mi asistencia: entrada/salida oficiales UTC, hora de Costa Rica y contador desde entrada persistida con compensación `server_now`. Varios intervalos, medianoche, doble clic, reintentos UUID y concurrencia; no inventa salidas. Abiertas >16 horas se señalan para revisión.
- [x] Control de asistencia: filtros, incidencias y correcciones de entrada/salida con motivo, responsable y originales/nuevos; sin borrado silencioso. Recuperación con motivo incluso sin una jornada previa. Colaborador ve el motivo de la corrección. No hay acceso de escritura para IA ni envío de registros personales a Drive/RAG.
- [x] Horarios por persona con versiones, vigencia, días, tolerancia y motivo; inicial lunes a viernes 08:00–17:00. Contexto guardado con la jornada para no reescribir incidencias al modificar horario; feriados/ausencias condicionan la interpretación. Son incidencias para revisión, no sanciones.
- [x] Bloqueo de colaborador y saldo/registro en la misma conexión transaccional; clave única de movimiento por solicitud y de persona con jornada abierta. Seguridad backend y cabecera CSRF no simple en las nuevas escrituras, junto a cookies SameSite Strict y rechazo de cross-site.
- [x] `npm test`: 29/29; `npm run test:integration`: 28/28 (dos contenedores, cuatro casos anteriores, veintiuno nuevos y la instalación nueva completa). Las tres bases aisladas se eliminan al finalizar. Escenarios obligatorios 1–19 cubiertos, además de cambios de saldo, CSRF y migración repetida.
- [x] `npm run build` exitoso. Ocho consultas HTTP nuevas mediante Vite con sesiones reales: 8/8 respuestas 200, sin crear registros operativos en el demo.
- [ ] Revisión visual interactiva del frontend y contador: no hay un navegador conectado en la herramienta (inventario vacío). Se verificaron la compilación, el cálculo del contador con reloj desfasado y la recuperación de entrada/hora del servidor por HTTP.
- [ ] Cargar y verificar feriados de años nuevos antes de confirmarlos en RRHH; cobertura automática disponible solamente para el importador conocido completo de 2026. El portal no importa feriados desde esta pantalla.
- Límites deliberados: sin pausas/almuerzo automático, planilla, horas extra pagaderas ni sanciones; horarios programados solo diurnos. Sin pantalla de ajuste manual de saldos ni detección automática de días sin marcación. El contador indica únicamente tiempo registrado entre marcas.
