# Entrega de Agenda Caucana para pruebas

## Qué se entrega

Esta copia contiene el estado actual del proyecto para pruebas locales. Está pensada para ejecutarse en una base PostgreSQL nueva, separada de la base del computador de desarrollo. No incluye cuentas ni datos privados de esa base.

El proyecto tiene dos partes:

- **Frontend:** HTML, CSS y JavaScript sin framework. Se sirve localmente en el puerto `5000`.
- **Backend:** Node.js, TypeScript, Express y Prisma, en el puerto `3000`.
- **Base de datos:** PostgreSQL. Las migraciones están en `backend/prisma/migrations`.
- **Chat IA:** consulta eventos y negocios publicados desde PostgreSQL; usa respuestas de catálogo y fallback y, si se configura `GEMINI_API_KEY`, puede usar Gemini. Tiene una caché en memoria con expiración; se vacía al reiniciar el backend.

El registro desde **Eventos** crea una cuenta de organizador de eventos, que debe verificarse antes de publicar eventos. El registro desde **Sabores** crea una cuenta gastronómica, que puede tener un negocio a la vez y editar también sus platos desde **Mis negocios**. Si el organizador elimina su negocio, libera el cupo para publicar otro; una eliminación administrativa no lo libera. Las especialidades se eligen al registrarse desde la sección correspondiente. El panel administrativo permite revisar perfiles, eventos y negocios y tomar acciones administrativas; no se usa para escoger la especialidad del usuario.

Los avisos se guardan en PostgreSQL. Los eventos de organizadores que ya finalizaron se limpian mediante una tarea programada y se invalida la caché del Chat IA. La página de rutas gastronómicas es contenido editorial y Sabores también muestra los negocios aprobados de la base.

## Requisitos para Windows

- Windows 10 u 11.
- Node.js 20 LTS o superior y npm.
- PostgreSQL 15 o superior, iniciado localmente.
- Python 3 para servir el frontend estático (`py` desde PowerShell).
- Navegador actualizado.

## Instalación limpia

1. Clona la rama actual del repositorio en una carpeta, por ejemplo `C:\AgendaCaucana`:

   ```powershell
   git clone --branch feat/alcance-core-sin-gamificacion https://github.com/CodeMarin21/agenda_caucana.git C:\AgendaCaucana
   ```

   También puedes descargar el ZIP de esta rama desde GitHub con **Code → Download ZIP** y extraerlo.
2. En PostgreSQL crea una base vacía llamada `agenda_caucana_pruebas`. Por ejemplo, desde pgAdmin: **Databases → Create → Database**.
3. Abre PowerShell en la carpeta extraída y configura el entorno local:

   ```powershell
   Copy-Item backend\.env.example backend\.env
   notepad backend\.env
   ```

4. En `backend\.env`, cambia:

   - `DATABASE_URL`: reemplaza el usuario y la contraseña por los de PostgreSQL y confirma que la base se llame `agenda_caucana_pruebas`. Si la contraseña contiene caracteres especiales, codifícala para URL.
   - `JWT_SECRET`: genera un valor propio, por ejemplo ejecuta `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` y pega el resultado.
   - `IDENTIDAD_ENCRYPTION_KEY`: genera 32 bytes en hexadecimal con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` y pega el resultado. Debe tener 64 caracteres hexadecimales. No la cambies después de cifrar documentos.

   Deja `UPLOAD_STORAGE=local` para las pruebas. `GEMINI_API_KEY`, SMTP y Cloudinary son opcionales; sin la clave Gemini, el chat sigue usando sus respuestas locales basadas en el catálogo, pero no respuestas generativas.

5. Instala dependencias, genera Prisma, aplica migraciones, carga el catálogo demo y crea una cuenta administradora local:

   ```powershell
   Set-Location backend
   npm ci
   npx prisma generate
   npx prisma migrate deploy
   npm run seed:demo
   node prisma\seed-admin.js admin-pruebas@local.test "Usa-Una-Clave-Local-De-12-Mas"
   ```

   Reemplaza el correo y la contraseña del último comando por valores propios. El script requiere una contraseña de al menos 12 caracteres y no la imprime. El catálogo demo es idempotente, pero ejecuta estos pasos solamente contra la base local de pruebas.

## Iniciar la aplicación

Deja abierta una primera ventana de PowerShell:

```powershell
Set-Location C:\AgendaCaucana\backend
npm run dev
```

En una segunda ventana:

```powershell
Set-Location C:\AgendaCaucana
py -m http.server 5000 --directory frontend
```

Abre <http://localhost:5000>. El backend debe responder en <http://localhost:3000/health>. Inicia sesión en <http://localhost:5000/login.html> con la cuenta administradora creada en el paso anterior.

Para detener cada servidor usa `Ctrl+C` en su ventana.

## Probar los recorridos principales

1. **Administrador:** iniciar sesión, abrir los apartados de Eventos, Negocios y Organizadores; probar revisión, aprobación, rechazo, suspensión y notificaciones.
2. **Eventos:** desde Rutas o la portada, registrarse como organizador de eventos. Completar el perfil y esperar la verificación administrativa antes de publicar. Revisar después **Mis eventos** y las notificaciones.
3. **Gastronomía:** desde Sabores, registrarse para publicar un negocio. La cuenta puede publicar uno inmediatamente y luego editar sus datos y platos desde **Mis negocios**. Revisar que aparezca en Sabores y en la ficha de detalle; verificar que una segunda publicación se bloquee mientras exista la primera, y que al eliminarla pueda crear otra.
4. **Chat IA:** preguntar por eventos, fechas, comida, platos, direcciones o presupuestos. Solo debe presentar publicaciones públicas vigentes.
5. **Recuperación de contraseña:** se usa el correo de prueba Ethereal cuando no hay SMTP propio. Revisa la salida de la consola del backend para abrir el enlace de vista previa del mensaje.

Para comprobar código, desde `backend`:

```powershell
npm run build
npm test
```

Las pruebas de integración antiguas pueden requerir una base de pruebas con sus datos/usuarios esperados; no ejecutes una suite contra una base con datos reales.

## Configuración y datos que no se deben compartir

- No compartas `backend\.env`; cada computador debe generar sus propios secretos y tener su propio `DATABASE_URL`.
- La carpeta `backend\uploads` contiene archivos locales de imágenes y no se incluye en el paquete.
- Tampoco se incluyen `node_modules`, compilados, logs, respaldos locales de PostgreSQL ni `.git`.
- Se omiten el experimento heredado de migración a MongoDB y su esquema alterno; la aplicación de esta entrega usa PostgreSQL.
- La copia incluye `backend\.env.example`, que solo contiene valores de ejemplo.
- El ZIP no contiene la base de datos real del computador de desarrollo. Para obtener una base de prueba se crea PostgreSQL vacío y se carga el catálogo incluido.

Para obtener los cambios más recientes después de clonar, ejecuta `git pull` dentro de la carpeta del proyecto. No se suben exportaciones de usuarios/tokens, archivos `.env`, ni el experimento heredado de migración a MongoDB.

## Prompt de contexto para compartir con un asistente

```text
Estoy probando Agenda Caucana. Es una aplicación web con frontend estático en HTML/CSS/JavaScript, backend Node.js + TypeScript + Express, Prisma y PostgreSQL. La carpeta frontend contiene las páginas públicas, Sabores, Rutas, Chat IA, login y paneles de administración/organización. El backend contiene API, autenticación, permisos, publicaciones, notificaciones, tareas programadas y lógica del chat.

Reglas centrales:
- La especialidad se decide durante el registro desde la sección de origen: Eventos -> organizador de eventos; Sabores -> organizador gastronómico. El administrador no la asigna.
- Eventos: el organizador necesita verificación administrativa antes de publicar.
- Gastronomía: el dueño puede registrar un negocio inmediatamente y editar esa publicación y sus platos; si la elimina puede registrar otro. El administrador conserva las acciones de supervisión y puede suspender o vetar según corresponda.
- Los paneles y publicaciones de eventos y gastronomía son separados.
- El Chat IA consulta información publicada de eventos y negocios (incluyendo platos, fechas, direcciones y precios); debe evitar inventar información y sugerir alternativas solo si coinciden realmente con la búsqueda.
- El backend usa caché en memoria; los datos de prueba viven en una base PostgreSQL local creada para este fin.

Estoy ejecutando una copia de pruebas local. No asumas que hay credenciales, GEMINI_API_KEY, SMTP o Cloudinary configurados. No muestres ni compartas secretos. Antes de proponer una migración o cambio destructivo, explica su impacto y pide confirmación. Primero reproduce el problema, inspecciona el código relacionado, haz cambios pequeños y ejecuta las pruebas dirigidas.
```
