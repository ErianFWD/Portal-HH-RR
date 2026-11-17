# Portal interno de RRHH

Prototipo local para Servicios del Pacífico S.A. Los datos son ficticios. No usar con datos reales: faltan pruebas integrales, endurecimiento, sincronización y controles documentales indicados en [SEGUIMIENTO.md](SEGUIMIENTO.md).

## Organización

- `backend/`: API, agentes, migraciones, scripts, pruebas y configuración `.env`.
- `frontend/`: interfaz React, HTML y configuración de Vite.
- Los comandos npm y la documentación compartida permanecen en la raíz.

## Requisitos y ejecución (PowerShell)

Necesitás Node.js 20 o superior, MySQL instalado y en ejecución, y acceso al registro npm. Creá la base `portalrrhh` en tu servidor MySQL y configurá en `backend/.env` el usuario, la contraseña, la dirección, el puerto y el nombre de la base. El ejemplo está en `backend/.env.example`. Desde la raíz:

```powershell
# Solo si backend/.env todavía no existe:
Copy-Item backend/.env.example backend/.env
# Editar backend/.env con la conexión MySQL y DEMO_PASSWORD de 12 caracteres o más.
npm install
npm run migrate
# Solo para una base nueva sin colaboradores:
npm run seed
npm run dev
```

Abrí http://127.0.0.1:5173. El seed inicial crea 250 colaboradores activos y una salida ficticia. Si `DEMO_PASSWORD` tiene al menos 12 caracteres, crea también los usuarios de desarrollo colaborador@demo.local y rrhh@demo.local con esa contraseña; si está vacía, omite los usuarios. Para agregarlos después, configurá la contraseña y ejecutá `npm run seed:users`. El seed se cancela si ya existen colaboradores y no reemplaza datos. Para verificar el frontend: `npm run build`; para pruebas unitarias: `npm test`. La aplicación escucha solo en localhost.

## Drive, Voyage y DeepSeek

1. Activá Google Drive API en un proyecto de Google Cloud y creá una cuenta de servicio. Guardá su archivo JSON en `backend/credenciales/`, carpeta cuyo contenido está excluido de Git, y configurá `GOOGLE_APPLICATION_CREDENTIALS` en `backend/.env` con la ruta absoluta. Por ejemplo: `GOOGLE_APPLICATION_CREDENTIALS=C:/ruta/al/proyecto/backend/credenciales/cuenta-servicio.json`. Compartí con el correo de la cuenta un Google Doc de política revisado y autorizado para todos los usuarios del portal. No compartas ni subas el JSON a Git.
2. En la descripción del archivo de Drive agregá APROBADO_RRHH solo después de revisar contenido, vigencia y autorización. Colocá su ID en DRIVE_FILE_ID. Agregá título, versión, vigencia y responsable al propio documento. No cargues borradores ni normativa no verificada.
3. Configurá `VOYAGE_API_KEY` y `DEEPSEEK_API_KEY` en `backend/.env`. Se usa `voyage-multilingual-2` de 1024 dimensiones para embeddings y `deepseek-flash` para redactar respuestas; el modelo se puede cambiar con `DEEPSEEK_MODEL`. El texto recuperado y la pregunta se envían a DeepSeek; no cargues datos sensibles sin evaluar las políticas aplicables.
4. Ejecutá `npm run ingest` y reiniciá el servidor si cambiaste `backend/.env`. Luego probá la consulta mixta desde el chat. Sin estas claves, la aplicación informa que no hay evidencia disponible; no genera citas de demostración.

La ingesta inicial solo acepta un Google Doc y se ejecuta manualmente; registra fragmentos numerados, versión de Drive y un enlace sujeto a los permisos de Google. No comprueba cambios o bajas automáticamente: reingestá después de cambios, y retiralo manualmente de la base si se revoca la aprobación. El filtro de similitud y la respuesta del modelo necesitan evaluación con documentos reales. Todos los usuarios del portal pueden recuperar todos los documentos aprobados del índice, por lo que no deben cargarse documentos privados.

Referencias oficiales: [Drive export](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/export), [Voyage embeddings](https://docs.voyageai.com/docs/embeddings), [DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/).

## Base de datos y búsqueda

La aplicación utiliza MySQL 8.4 con Sequelize. Los modelos están en `backend/server/models.js` y apuntan a las tablas existentes; no se ejecuta `sync` ni se modifica el esquema automáticamente. La consulta del saldo usa un modelo y las consultas restantes utilizan SQL parametrizado mediante Sequelize. Las migraciones se ejecutan con `npm run migrate`.

Los embeddings se guardan como JSON y la similitud coseno se calcula en Node sobre todos los fragmentos aprobados. Es una búsqueda exacta y lineal adecuada solo para el corpus pequeño del prototipo; hay que medir rendimiento y considerar un índice vectorial externo para escalar. No migra automáticamente datos de PostgreSQL: respaldá y migrá los datos existentes antes de cambiar de base.
