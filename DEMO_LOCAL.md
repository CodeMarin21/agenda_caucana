# Ejecutar Agenda Caucana en otro computador

Esta guía prepara una instalación local completa para revisión. El catálogo incluido contiene únicamente los eventos y negocios que estaban publicados y aprobados al generar la copia. No incluye cuentas de usuarios, contraseñas, reseñas, conversaciones ni credenciales de servicios externos.

## Requisitos

- Windows 10/11
- Node.js 20 LTS o superior
- PostgreSQL 15 o superior, instalado y ejecutándose localmente
- Git
- Python 3 (solo para servir el frontend estático)

## 1. Descargar el proyecto

En PowerShell:

```powershell
git clone --branch feat/alcance-core-sin-gamificacion https://github.com/CodeMarin21/agenda_caucana.git
cd agenda_caucana
```

## 2. Crear y configurar la base local

En PostgreSQL, crea una base vacía llamada `agenda_caucana_demo`. Copia el ejemplo de configuración y edita el archivo local:

```powershell
Copy-Item backend\.env.example backend\.env
notepad backend\.env
```

Reemplaza `CAMBIA_ESTA_CLAVE` en `DATABASE_URL` por la contraseña del usuario local de PostgreSQL. Genera valores propios para `JWT_SECRET` y `IDENTIDAD_ENCRYPTION_KEY`; no reutilices claves de otra computadora ni compartas el archivo `backend\.env`.

Puedes generar valores aleatorios con Node.js:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Usa el primer resultado como `JWT_SECRET` y el segundo como `IDENTIDAD_ENCRYPTION_KEY`.

## 3. Instalar, preparar y cargar el catálogo

```powershell
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed:demo
```

`seed:demo` es idempotente: puede ejecutarse otra vez para actualizar las publicaciones de demostración. Debe usarse únicamente en la base local vacía creada para esta revisión; no borra otros registros.

## 4. Iniciar backend y frontend

Deja el backend ejecutándose en la primera ventana de PowerShell:

```powershell
npm run dev
```

Abre otra ventana de PowerShell, vuelve a la carpeta clonada y sirve el frontend:

```powershell
cd agenda_caucana\frontend
python -m http.server 5000
```

Abre <http://localhost:5000/index.html>. El backend estará en <http://localhost:3000>.

## Funciones que requieren servicios externos

El sitio, los eventos y los negocios de demostración funcionan localmente con PostgreSQL. Las respuestas generativas del chatbot requieren una clave propia `GEMINI_API_KEY`; el envío real de correos y la carga de nuevas imágenes requieren configurar `MAIL_*` y Cloudinary, respectivamente. Sin esas claves, esas integraciones no estarán disponibles. No se debe copiar el `.env` del computador de desarrollo.

El catálogo conserva las fechas originales de publicación; algunos eventos pueden haber terminado y no aparecer en listados que muestran solo próximos eventos.
