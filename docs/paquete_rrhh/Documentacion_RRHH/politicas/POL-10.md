# Aviso de privacidad para colaboradores

POL-10 · Versión 1.0 · Vigencia 2026-11-17 · Responsable RRHH · Público colaboradores · Estado activo para el caso académico

Empresa ficticia: Servicios del Pacífico S.A., servicios administrativos, Costa Rica. Reglas internas simuladas; no usar como reglamento real aprobado.

## 1 Responsable y propósito

Servicios del Pacífico S.A. es una empresa ficticia. En este laboratorio se usan únicamente personas, correos, saldos y movimientos simulados. El portal permite consultar políticas, datos propios y reportes operativos. Este aviso no autoriza el ingreso de datos reales al entorno de prueba.

## 2 Separación de datos

El índice vectorial contiene políticas de acceso general. PostgreSQL contiene identidades, saldos, solicitudes y logs. Los datos personales no se incorporan a los documentos del RAG. La protección de datos exige finalidad, acceso controlado y tratamiento especial de información sensible conforme a la Ley 8968 [S12]. La base y excepciones aplicables deben evaluarse antes de cualquier despliegue real.

## 3 Acceso

Colaborador: solo sus datos. RRHH: operaciones autorizadas por su función, con registro de acceso. El rol se valida en el servidor. No aceptar otro colaborador_id suministrado por el usuario para ampliar permisos. El LLM recibe únicamente los campos mínimos del resultado autorizado, nunca claves, hashes de contraseña ni expedientes médicos.

## 4 Registros y derechos

Como decisión del laboratorio, conservar texto de consultas y trazas depuradas durante 90 días y métricas diarias agregadas sin identificadores durante 12 meses. Eliminar o anonimizar después según procedimiento documentado. No conservar datos sensibles innecesarios en prompts o logs. Solicitudes de acceso, rectificación o eliminación se gestionan con RRHH; su aplicación real depende de obligaciones de conservación. Al cerrar el laboratorio, borrar datos de prueba y revocar accesos que ya no se utilicen.

## Fuentes oficiales

[S12] PGR tratamiento de datos personales Ley 8968. Consulta 2026-11-17. https://www.pgrweb.go.cr/DOCS/DICTAMENES/1/P/D/2020-2029/2020-2024/2021/147B50.HTML

