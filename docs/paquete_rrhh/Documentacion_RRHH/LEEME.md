# Documentación para continuar con Codex

Paquete del Mini Proyecto 2. Empresa ficticia Servicios del Pacífico S.A., Costa Rica. Fecha del escenario: 17 de noviembre de 2026. Solo datos simulados.

## Qué contiene

Diez políticas POL-01 a POL-10, cada una en Markdown para código y PDF para Drive. Un Word editable reúne las diez, separado por política. Dos calendarios CSV para importar en Google Sheets y SQL. Un catálogo JSON de documentos. Una especificación de agentes, datos, seguridad, reportes y pruebas. Prompts iniciales y una hoja CSV con 45 preguntas sin resultados inventados. Fuentes oficiales con URL y fecha de consulta.

## Cómo usarlo ahora

1. Descomprimir y copiar esta carpeta a docs del repositorio donde trabaja Codex. No copiar archivos de credenciales aquí.
2. Entregar a Codex la instrucción de PROMPT_PARA_CODEX.txt junto con el enunciado original. Codex debe leer primero especificacion/CONTINUAR_CON_CODEX.md.
3. En Drive, crear una carpeta para las políticas y compartirla con el correo de la cuenta de servicio como Lector. No hacerla pública.
4. Subir los diez PDF como diez documentos independientes. Para cumplir los distintos formatos, reemplazar uno de esos PDF por su contenido en Google Docs: abrir Politicas_RRHH_editables.docx, copiar solo la política elegida a un nuevo Google Doc y mantener el ID POL correspondiente. No indexar el Word completo además de todos los PDF, porque duplicaría el contenido.
5. Importar feriados_2026.csv y pagos_2026.csv en una hoja de Google Sheets con pestañas Feriados y Pagos. Verificar fechas al importar. El CSV utiliza separador coma y fechas ISO. El calendario de pagos es una regla ficticia aplicada sobre los feriados oficiales, no una fecha nacional de pago.
6. Registrar en politicas/catalogo.json los IDs y enlaces reales. No dejar enlaces inventados. Los metadatos del calendario son versión 1.0, responsable RRHH y vigencia del año 2026.
7. Reemplazar el documento mínimo de conexión por contenido útil de estas políticas y volver a indexar. La prueba con un DRIVE_FILE_ID no sustituye la ingesta de una carpeta completa. Pedir a Codex adaptar la configuración al código existente.
8. Ejecutar primero preguntas 1, 2, 19, 21 y 23 del banco. Después las 45. Los resultados reales se agregan a la hoja de evaluación.

## Alcance

Las reglas internas y contactos .example son ficticios. Los documentos están preparados para un escenario académico, no representan aprobación de una empresa real. Las referencias legales se verificaron en fuentes oficiales disponibles al 17 de noviembre de 2026. Casos particulares, fueros y cálculos individuales requieren revisión. El expediente real de una denuncia o incapacidad no pertenece al RAG general.

Este paquete permite continuar la implementación. No sustituye el informe de investigación académico de 6 a 10 páginas ni el informe técnico final de 8 a 12 páginas: el primero debe desarrollar el análisis del equipo y el segundo necesita resultados medidos de su aplicación. No se han creado documentos en tu Drive ni probado tu backend desde aquí.
