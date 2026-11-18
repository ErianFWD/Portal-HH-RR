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

La búsqueda coseno es lineal sobre JSON en MySQL. El valor de vacaciones en riesgo corresponde al saldo actual, incluso al recuperar un reporte histórico. Google Sheets exporta la primera pestaña; los PDF deben tener texto. El portal no crea tickets ni envía solicitudes. La retención automática y las pruebas de carga de despliegue quedan fuera de la validación actual.
