# Seguimiento de requisitos

## Primera entrega

- [ ] Validar migración a MySQL con un servidor real; se conservan embeddings en JSON y búsqueda coseno en Node.

- [x] Estructura, configuración validada, conexión a MySQL local, migración y seed ficticio.
- [x] Sesiones persistidas con contraseña hash; consulta SQL parametrizada al saldo propio; endpoint de RRHH protegido.
- [x] Módulos separados de orquestación, datos, políticas e ingesta; trazas para intervenciones exitosas.
- [x] Interfaz de login, chat, fuentes e historial básico de reportes.
- [ ] Verificar de extremo a extremo con MySQL, credenciales y documento aprobado.
- [ ] Citas por sección real y vigencia extraída; la entrega usa número de fragmento y remite vigencia al documento.
- [ ] Pruebas de seguridad adversarias, registro de errores de agentes, límites de intentos y endurecimiento para producción.
- [ ] Clasificación robusta y evaluación de calidad: las reglas iniciales son limitadas.

## Alcance posterior obligatorio

- [ ] Investigación oficial de 6–10 páginas y diez políticas originales revisadas, incluyendo PDF, Doc y hoja de cálculo. Ningún borrador está indexado.
- [ ] Sincronización diaria automática de altas, cambios y bajas de Drive; evitar servir documentos revocados.
- [ ] Analista, cálculos SQL, informe diario 7:00 America/Costa_Rica, idempotencia, métricas y resumen respaldado por cifras.
- [ ] Dashboard completo: indicadores, gráficos, pendientes y reportes.
- [ ] Banco de 45 preguntas (las 25 preguntas están disponibles en el PDF; aún falta incorporarlas), evaluación de 80 %, cero fugas y p90 menor a 8 s.
- [ ] Completar escenarios de ausencias y asegurar coherencia temporal de los datos simulados.

La delegación explícita con reglas y funciones separadas limita herramientas y facilita auditoría; no se confía en SQL generado por el modelo. El clasificador aún no cubre lenguaje natural amplio y debe evaluarse antes de uso real.
