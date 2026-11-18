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

No incluye envío de solicitudes, tickets, planilla individual, OCR, despliegue público ni retención automática destructiva. El proceso único local y el limitador de memoria requieren adaptación antes de escalar a varias instancias.

Referencias de implementación: [Drive changes](https://developers.google.com/workspace/drive/api/guides/manage-changes), [exportación](https://developers.google.com/workspace/drive/api/guides/manage-downloads) y [formatos de Workspace](https://developers.google.com/workspace/drive/api/guides/ref-export-formats).
