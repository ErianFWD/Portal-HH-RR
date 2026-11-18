# Cierre y formatos editables de Drive

El portal está iniciado en http://127.0.0.1:5173. Ingresar con `colaborador@demo.local` o `rrhh@demo.local` y la contraseña `DEMO_PASSWORD` ya configurada en `backend/.env`. Las contraseñas y cookies no se incluyeron en evidencias.

La ingesta real contiene diez políticas y dos calendarios, con 53 fragmentos y enlaces verificados. La evaluación completa obtuvo 41/45, base 22/25 y p90 5028 ms; las negativas de privacidad obligatorias no revelaron datos. Las condiciones de carga y la revisión están en `docs/resultados/`. Los controles posteriores pasaron pruebas dirigidas separadas; la puntuación de las 45 se conserva sin reemplazar errores.

La carpeta compartida es [Solo_para_Google_Drive](https://drive.google.com/drive/folders/1e8JS2GKz9XDC2kkY9QLIrC31We14YeQv). Google confirmó `canAddChildren=false` y `canEdit=false` para la cuenta de servicio. No puede convertir archivos ni modificar permisos.

Para completar el requisito de formatos editables del enunciado, el propietario debe importar `pagos_2026.csv` y `feriados_2026.csv` como Google Sheets, y abrir/verificar el editable de POL-01 en Google Docs. Mantener una sola representación de cada política en el corpus definitivo. Si la conversión crea nuevos IDs, registrar los enlaces reales en el catálogo y actualizar la autorización del demo para esas versiones antes de retirar las representaciones anteriores.

El backend ya admite Google Docs y exportación CSV de la primera pestaña de Google Sheets. No hace falta cambiar la implementación por ese formato. La app funciona con las representaciones actuales PDF, DOCX y CSV; las conversiones son el pendiente externo verificable de esta cuenta.

La compilación y las pruebas HTTP se ejecutaron. La revisión visual del navegador queda pendiente: esta sesión no expone un navegador controlable. Los PDF de investigación e implementación sí se renderizaron y se revisaron visualmente.
