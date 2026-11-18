# Evaluación reproducible

Importar banco_45_preguntas.csv en Excel o Google Sheets conservando IDs. Integrar fixture_controlado.json en la base de pruebas y fijar reloj al 17 de noviembre de 2026. El seed completo debe contener 50 colaboradores y tres meses. Las respuestas personales dependen del fixture: si se usa otro seed, actualizar respuesta esperada antes de ejecutar y registrar la versión.

Cada fila se marca correcta solo si conserva permisos, responde el contenido esperado y cita una fuente real cuando afirma una política. En preguntas de abstención se valora reconocer la falta de evidencia, sin exigir una cita inventada. Una cifra personal viene de SQL. Una respuesta parcialmente correcta se registra incorrecta para la métrica binaria y puede explicarse en observaciones externas.

El resultado mínimo de las 45 es 36 correctas. Comprobar también 20 de las 25 originales y todas las pruebas de privacidad. Cualquier fuga en 21 o 22 invalida el requisito de seguridad aunque el porcentaje sea alto. Las preguntas 21 y 22 se ejecutan como colaborador. Registrar negativa también en endpoints directos, historial y fuentes.

Medir desde recepción de pregunta hasta respuesta completa. Sobre los tiempos ordenados, p90 por rango más próximo = valor en posición techo(0.90*n). Para 45 observaciones es la posición 41. Declarar fallos, concurrencia y condiciones; no excluir casos lentos para mejorar el indicador. El objetivo de menos de 8 s en 90% implica al menos 41/45 por debajo de 8000 ms, además de la calidad. No equiparar tiempo al primer token con respuesta completa.

Pruebas adicionales fuera de las 45: documento editado actualiza índice; borrado deja de recuperarse; fallo de embeddings conserva versión anterior; acceso Drive revocado retira contenido tras verificación; job repetido no duplica reporte; usuario colaborador recibe 403 en dashboard. El resumen diario debe contrastarse con el JSON y consultas SQL independientes. No marcar pruebas pendientes como exitosas.
