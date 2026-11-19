# Portal de RRHH · Servicios del Pacífico S.A.

Aplicación local para un caso académico de Costa Rica, con datos ficticios. Incluye sesión persistida, asistente con herramientas acotadas, datos propios, historial privado, reportes diarios y dashboard de RRHH. El estado verificable está en [SEGUIMIENTO.md](SEGUIMIENTO.md).

## Ejecución

Requiere Node.js 20+, MySQL 8.4 y la base `portalrrhh`. Configurar `backend/.env` desde `backend/.env.example`. Las credenciales reales y los archivos JSON de servicio están excluidos de Git.

```powershell
npm install
npm run migrate
# Solo para una base completamente nueva:
npm run seed
# En la base ficticia del proyecto:
npm run seed:fixture
npm run seed:history
npm run seed:repair-history
npm run dev
```

Abrir http://127.0.0.1:5173. Los usuarios ficticios son `colaborador@demo.local` y `rrhh@demo.local`; su contraseña proviene de `DEMO_PASSWORD`. `seed:users` permite crearlos cuando no existen y no reemplaza usuarios. La aplicación escucha únicamente en localhost.

## Drive y modelos

`DRIVE_FOLDER_ID` debe identificar la carpeta definitiva de políticas generales y calendarios. Se recorren sus subcarpetas y se verifican cambios, eliminaciones y pérdida de alcance. `DRIVE_FILE_ID` queda como configuración histórica y ya no controla la ingesta.

La cuenta de servicio utiliza el JSON indicado por `GOOGLE_APPLICATION_CREDENTIALS`. Compartir la carpeta con su correo. El documento debe contener `APROBADO_RRHH` en la descripción después de la revisión autorizada. Opcionalmente incluir `vigente_desde:2026-11-17` y `vigente_hasta:YYYY-MM-DD`. La aplicación no cambia permisos ni concede esa aprobación automáticamente. La sincronización informa archivos pendientes de aprobación y errores; no los omite silenciosamente.

Para este demo, el usuario autorizó expresamente el 18-11-2026 las diez políticas y los dos calendarios ficticios para Voyage y DeepSeek. En desarrollo se admite `DEMO_APPROVAL_MANIFEST=docs/resultados/autorizacion_demo.json`: limita esa autorización a IDs y versiones concretos, con vigencia y enlaces verificados. Si un archivo cambia de versión, deja de estar autorizado por ese manifiesto. Este mecanismo no se aplica en producción ni modifica metadatos o permisos en Drive; tampoco acredita aprobación empresarial real.

```powershell
npm run drive:check
npm run ingest
```

Se admiten Google Docs, Google Sheets (exportación CSV de la primera hoja), PDF con texto, DOCX, Markdown, TXT y CSV. Los PDF escaneados requieren OCR externo. Mantener una sola representación de cada política. Las guías, prompts y credenciales no pertenecen al corpus.

El texto de documentos se envía a Voyage para embeddings; la pregunta y los fragmentos recuperados se envían a DeepSeek para responder. Los datos personales se consultan con SQL parametrizado y se redactan sin enviarlos al modelo. El clasificador recibe pregunta, fecha y rol; el analista recibe exclusivamente métricas agregadas. El corpus debe estar autorizado para esos destinos. Los correos `.example` de las políticas son ficticios y el portal no envía tickets.

## Reportes y dashboard

Con `JOBS_ENABLED=true`, el proceso de API verifica cada minuto si corresponde el corte de las 07:00 en `America/Costa_Rica`. Al reiniciar recupera hasta treinta fechas faltantes posteriores al último reporte. Mantener el proceso ejecutándose para automatización diaria. Una instalación nueva produce el último corte; no inventa tres meses de reportes guardados.

El usuario también autorizó explícitamente el envío a DeepSeek de métricas ficticias agregadas sin nombres ni preguntas. `ANALYST_LLM_ENABLED=true` está habilitado para este demo; el ejemplo de configuración lo deja desactivado para otras instalaciones. La verificación de la redacción y la huella del JSON se conservan en `docs/resultados/validacion_resumen_ia.json`. Regenerar solo el resumen no modifica las cifras del reporte y conserva auditoría.

RRHH puede generar un reporte manual, consultar indicadores, dos gráficos (incluida una serie SQL de treinta días), solicitudes pendientes y descargar JSON con procedencia. La clave única por fecha y el bloqueo transaccional evitan duplicados. El modelo redacta de tres a cinco frases con validación de cifras y sin tendencias no sustentadas; tras dos fallos se guarda una plantilla identificada y un código de error.

Las reglas de corte, rotación, superposición de incapacidades y denominadores están implementadas en `backend/server/agents/analyst.js`. El saldo de riesgo es actual: los saldos anteriores no se reconstruyen para reportes recuperados. El dashboard etiqueta expresamente ese dato.

## Validación

```powershell
npm test
npm run test:integration
npm run build
# Requiere diez políticas realmente indexadas y autorización de uso de los modelos:
npm run evaluate
# Después de revisar correcta=Sí/No en cada fila ejecutada:
npm run evaluate:summary
```

Las pruebas de integración crean y eliminan únicamente una base efímera `portalrrhh_test_<pid>`; el usuario MySQL de pruebas necesita esos permisos. Comprueban cálculos de frontera, ejecución simultánea, permisos, historial y fallos de ingesta con un Drive simulado. No sustituyen la prueba de proveedores reales. La evaluación conserva las 45 preguntas, reloj fijo 2026-11-17, modelo, umbral, condiciones y latencia completa; nunca marca una política correcta solo porque se obtuvo una respuesta.

La muestra real usa concurrencia 1 y llegadas separadas 21 segundos por la cuota observada de Voyage. Cada pregunta mide su respuesta completa desde la entrada al servicio del asistente; no es una prueba HTTP de ráfaga. Las corridas, incluida una inicial que no aprobó, se archivan con fecha. La calibración de recuperación con consultas agrupadas se guarda aparte y no se usa para declarar latencia de las 45 preguntas. La revisión asistida de contenido conserva una decisión y un motivo por fila.

`npm run reports:pdf` genera los informes de investigación (8 páginas) y técnico (10 páginas) en `output/pdf/` y renderiza vistas de control. Los textos fuente y las mediciones permanecen en el repositorio para su revisión. La cuenta de servicio solo tiene lectura en Drive; la importación de los CSV como Google Sheets debe realizarla el propietario de la carpeta.

Las políticas originales, calendarios y catálogo están en `docs/paquete_rrhh/Documentacion_RRHH/`. Las guías están en `docs/guias_rrhh/`. El catálogo no inventa enlaces: los IDs reales deben corresponder a los archivos compartidos y aprobados.

## Arquitectura y límites

MySQL con Sequelize, embeddings JSON de 1024 dimensiones y búsqueda coseno en Node para el corpus pequeño. Los fragmentos se filtran por modelo, dimensión y vigencia. La sincronización calcula embeddings antes de sustituir el índice y usa una sola transacción con savepoints por documento; un fallo conserva su índice anterior. Los tokens de Drive avanzan solo tras procesamiento duradero sin errores de documentos.

La recuperación combina coseno con términos del texto, cinco fragmentos iniciales y contexto de secciones vecinas y de la política principal. La consulta conserva los antecedentes del usuario y excluye rol y reloj añadidos por el modelo. Las portadas aisladas no desplazan reglas sustantivas. La versión visible se extrae del texto de la política; el número de revisión de Drive se mantiene separado para sincronización.

El backend determina identidad y permisos desde la sesión; ignora identidades del cuerpo. Los colaboradores reciben 403 en endpoints RRHH y 404 para conversaciones ajenas. Usuarios o colaboradores inactivos no pueden mantener una sesión. El login limita intentos por IP y el chat permite una petición concurrente por usuario en el proceso.

No incluye tickets, planilla individual, OCR, despliegue público ni retención automática destructiva. El proceso único local y el limitador de memoria requieren adaptación antes de escalar a varias instancias.

Referencias de implementación: [Drive changes](https://developers.google.com/workspace/drive/api/guides/manage-changes), [exportación](https://developers.google.com/workspace/drive/api/guides/manage-downloads) y [formatos de Workspace](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).

## Solicitudes de vacaciones y asistencia

Ejecutar `npm run migrate` antes de iniciar la versión actual. La migración **003_workflows.js**, aditiva e idempotente, extiende `solicitudes` y crea `movimientos_vacaciones`, `solicitudes_auditoria`, `asistencia`, `asistencia_correcciones`, `marcas_idempotencia`, `horarios` y `calendarios_cobertura`. Agrega claves foráneas e índices, incluida una clave generada única que impide dos jornadas abiertas por colaborador. No utiliza `sync`, no elimina datos y no vuelve a descontar vacaciones históricas aprobadas. Ya fue aplicada al demo local el 18-11-2026.

**Colaborador:** entrar a **Mis solicitudes**, seleccionar fechas y calcular los días hábiles antes de confirmar. El servidor valida fechas reales desde hoy en Costa Rica, orden, rango de hasta 366 días, feriados, saldo y conflictos con solicitudes pendientes/aprobadas e incapacidades. El mensaje es opcional. El historial muestra respuesta y fecha de resolución; una pendiente propia puede cancelarse. **Mis datos** y el asistente distinguen saldo confirmado, reservas y disponibilidad.

**RRHH:** entrar a **Gestionar solicitudes**, filtrar por persona, departamento, estado y fechas; abrir el detalle y aprobar o rechazar. El rechazo exige respuesta. No se permite resolver solicitudes propias ni volver a decidir una resuelta. Los permisos y licencias no descuentan vacaciones. La respuesta se publica dentro del portal; no se envían correos ni WhatsApp. Las aprobadas alimentan las consultas de ausencias existentes, sin regenerar las instantáneas de reportes guardadas.

### Regla única de saldo

- `dias = dias_asignados - dias_tomados + ajustes`; `dias` es el saldo confirmado, con DECIMAL convertido explícitamente a número para comparar.
- Al migrar se conserva `dias` y se reconcilia `ajustes` con los componentes históricos. Se registra una apertura sin descuento; no se reprocesan aprobadas históricas. Los seeds nuevos mantienen la misma ecuación, registran su apertura y los cambios de saldo del fixture.
- Reserva = suma de `dias_solicitados` en vacaciones pendientes, incluidas las pendientes históricas calculadas durante la migración. Disponibilidad = saldo confirmado menos reservas. Puede ser negativa si el historial ya estaba sobre-reservado; se muestra y se bloquean nuevas solicitudes hasta resolverlo, sin inventar saldo.
- Crear reserva no modifica `dias`. Aprobar revalida calendario, conflictos y disponibilidad, aumenta `dias_tomados`, disminuye `dias` y termina la reserva en una sola transacción. Rechazar/cancelar libera la reserva sin cambiar el saldo confirmado. Cada descuento tiene un movimiento con saldo anterior/nuevo y solicitud única; las decisiones y cancelaciones quedan auditadas.
- Se bloquea primero la fila de colaborador y luego el saldo/solicitud en una misma conexión transaccional MySQL. Dos creaciones o aprobaciones simultáneas se serializan; los reintentos de una decisión ya aplicada reciben conflicto y no vuelven a descontar.

La cobertura de feriados se declara explícitamente por año. Solo el importador conocido del calendario completo ficticio 2026 certifica automáticamente ese año. Un conteo de feriados no prueba cobertura. RRHH puede confirmar otros años en **Control de asistencia → Cobertura del calendario**, después de cargar y verificar todos sus feriados en SQL, indicando fuente. La confirmación conserva responsable y fecha y no importa datos. Una solicitud o aprobación sin cobertura se bloquea. Los feriados de 2027 en adelante deben cargarse y verificarse; no se extrapola 2026.

### Marcaciones, contador y correcciones

En **Mi asistencia**, marcar entrada y luego salida. Se permiten varios intervalos no solapados por día y jornadas que atraviesan medianoche. La hora oficial proviene del servidor; los cuerpos de marcación normal solo admiten una clave UUID de idempotencia. Se guardan instantes UTC y se muestran en `America/Costa_Rica`. Las peticiones simultáneas se serializan por colaborador y la misma clave recupera el registro previo sin duplicarlo ni cerrar una jornada posterior.

El contador representa **tiempo registrado entre marcas**, calculado desde la entrada persistida, con `server_now` y un reloj monotónico del navegador. Al volver a abrir la sección o recuperar visibilidad se consulta el servidor; no depende de localStorage. Después de salida muestra la duración cerrada. No descuenta almuerzo, no calcula planilla ni horas extra pagaderas. Una jornada abierta por más de 16 horas se señala para revisión, sin inventar una salida ni cerrarla por cambio de fecha.

En **Control de asistencia**, RRHH filtra personas, departamentos, fechas y estado (incluidas incidencias), revisa y corrige una entrada o salida, o completa una salida olvidada. Si no existe registro, el botón **Completar marcación olvidada** permite recuperar una entrada y su salida opcional para la persona seleccionada, con auditoría de creación. Las horas del formulario son de Costa Rica. Toda corrección exige motivo, rechaza futuros, duraciones negativas y solapamientos, y guarda responsable, fecha y valores originales/nuevos en una auditoría inmutable. El colaborador ve que hubo corrección y el motivo. No se borran registros originales silenciosamente.

El horario inicial es lunes a viernes 08:00–17:00, tolerancia inicial cero. RRHH crea versiones por persona con vigencia desde hoy o una fecha futura, días, horas, tolerancia y motivo. El horario admite jornadas diurnas; una jornada marcada puede cruzar medianoche. Las incidencias de entrada/salida usan el horario aplicable al día de entrada, feriados y ausencias aprobadas. La jornada conserva una instantánea del contexto: un nuevo horario no reescribe incidencias anteriores. Una corrección explícita puede recalcularlas dejando el contexto anterior en auditoría. Sin cobertura de calendario se señala incertidumbre y no se clasifica automáticamente tardía/anticipada. Las incidencias requieren revisión y no generan sanciones.

Servicios y rutas están separados en `backend/server/workflows/`; componentes en `frontend/src/workflows/`. Las nuevas escrituras exigen sesión, autorización de rol y cabecera no simple `X-Portal-Request: 1`, rechazan `Sec-Fetch-Site: cross-site` y conservan cookies httpOnly SameSite Strict, sin habilitar CORS. La identidad personal siempre se toma de la sesión; las herramientas de IA no tienen acceso a escrituras ni incorporan marcaciones al RAG.

### Validación de estos flujos (18-11-2026)

- `npm test`: 29/29 pruebas unitarias aprobadas.
- `npm run test:integration`: 28/28 comprobaciones aprobadas (incluidos los dos contenedores de prueba): 4 casos existentes, 21 casos nuevos y una instalación nueva completa, en bases efímeras separadas `portalrrhh_test_<pid>` y `portalrrhh_workflows_test_<pid>`, más `portalrrhh_seed_test_<pid>` para el ciclo completo de seeds, eliminadas al finalizar. Requiere permisos MySQL para crearlas y eliminarlas.
- Los casos nuevos cubren los 19 escenarios solicitados: saldo, feriados, reservas, conflictos, resolución simultánea, liberación, respuesta visible, privacidad/CSRF, entradas/salidas, relectura persistida del contador, reintentos, medianoche, correcciones auditadas, intervalos, vigencia y tolerancia. También comprueban migración repetida, preservación del historial y revalidación de saldo modificado.
- `npm run build`: compilación exitosa. Prueba HTTP contra el demo mediante Vite: 8/8 consultas nuevas con sesión y rol respondieron 200, sin modificar vacaciones ni asistencia de demostración.
- No se pudo realizar inspección visual interactiva: la herramienta de navegador devolvió inventario vacío. La prueba de recarga verifica los datos persistidos y la base del contador por HTTP; la interacción visual del contador queda pendiente de revisión en navegador.

Límites: no se generan ausencias por falta de marcación ni sanciones; no hay pausas ni cálculo salarial. La interfaz no importa calendarios ni ajusta saldos manualmente; los ajustes administrativos externos deben conservar la ecuación y registrar un movimiento. La gestión de horarios no contempla turnos programados nocturnos. No se enviaron datos de asistencia a proveedores de IA.
