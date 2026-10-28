# Agenda Caucana — Frontend

Vanilla JS + HTML + CSS, sin frameworks, tal como se definió. Construido a partir
de los 6 bocetos de Figma (Home desktop/mobile, Detalle de evento, Panel Admin,
Dashboard Organizador) y de los assets reales del hero (imagen + video).

## Cómo verlo

No necesitas Node para el frontend en sí — son archivos estáticos. Pero abrir
`index.html` con doble clic (protocolo `file://`) hace que `fetch()` falle por
CORS, así que sírvelo con un servidor local. En PowerShell, desde la carpeta
`frontend/`:

```powershell
# Si tienes Python instalado:
python -m http.server 5500

# o si prefieres Node (npx, sin instalar nada global):
npx serve .
```

Y abre `http://localhost:5500` (o el puerto que indique la herramienta).

## Conectar con el backend real

1. Levanta el backend como ya lo haces: `npm run dev` desde `backend/`.
2. Revisa `js/config.js` — `API_BASE_URL` apunta a `http://localhost:3000/api`
   por defecto. Ajústalo si tu backend corre en otro puerto.
3. **Falta la pantalla de login** (no estaba en los bocetos que se armaron
   hasta ahora) — así que Admin y Organizador asumen que ya existe un JWT
   guardado. Mientras no exista esa pantalla, puedes generarlo a mano desde
   la consola del navegador después de loguearte por Postman/Invoke-RestMethod:
   ```js
   AC_API.setToken('pega_aqui_el_jwt')
   ```
4. Si el backend no está corriendo, el Home y el Detalle de evento igual se
   ven bien — se quedan con los datos de ejemplo que trae el HTML — pero
   Admin/Organizador (aprobar, verificar, publicar) sí necesitan el backend
   arriba porque no tienen datos de respaldo para las acciones.

## Estructura

```
frontend/
├── index.html              → Home público (hero animado + buscador + grid)
├── evento.html              → Detalle de evento (?slug=... en la URL)
├── admin/
│   ├── resumen.html
│   ├── eventos.html
│   └── organizadores.html
├── organizador/
│   ├── mis-eventos.html
│   ├── publicar.html
│   └── perfil.html
├── css/
│   ├── variables.css        → paleta, tipografía, tokens de espaciado
│   ├── base.css              → reset, botones, badges, tablas — compartido
│   ├── public.css            → nav, hero, buscador, grid, footer, chat
│   └── dashboard.css         → sidebar, tablas, formularios de admin/organizador
├── js/
│   ├── config.js              → API_BASE_URL
│   ├── api.js                 → cliente fetch de todos los endpoints reales
│   ├── i18n.js                → traducción de textos estáticos (ES/EN/FR)
│   ├── hero-video.js           → ping-pong loop del video + reduced-motion
│   ├── chat.js                 → widget de Chat IA (POST /api/chat)
│   ├── home.js                  → carga eventos/categorías reales en el home
│   ├── evento.js                 → carga el evento por slug
│   ├── admin.js                   → aprobar/rechazar/verificar/suspender
│   └── publicar.js                 → envío del formulario de nuevo evento
├── locales/{es,en,fr}.json
└── assets/hero/
    ├── hero-popayan.png    → imagen estática (poster + fallback mobile/reduced-motion)
    └── hero-popayan.mp4    → video en loop del hero (desktop/tablet)
```

## Decisiones que tomé al construir

- **El hero tiene movimiento en desktop/tablet, imagen estática en mobile**
  (`max-width: 640px`) y también estática si el usuario tiene activado
  "reducir movimiento" en su sistema — ambos casos exigidos: "sí o sí
  movimiento" en el punto correcto, "sí o sí responsive" en todo lo demás.
- El texto dinámico (nombres de evento, categorías, etc.) NO pasa por los
  archivos de `locales/` — viaja ya traducido desde el backend, porque el
  middleware i18n del backend lee `Accept-Language` y lo resuelve del lado
  del servidor. Los `locales/*.json` del frontend solo traducen textos fijos
  de la interfaz (nav, botones, placeholders).
- Los botones y tarjetas usan bordes rectos/mínimos y colores planos a
  propósito — es la decisión de diseño para que no se vea como un kit de
  SaaS genérico (sombras grises idénticas, radios de 12-16px en todo).
- El estado "Rechazado/Suspendido" usa un óxido (`--color-rechazo: #8C3B2E`)
  en vez de un rojo saturado genérico, para no romper la paleta.

## Pendiente (fuera del alcance de este set de bocetos)

- Pantalla de login/registro (auth) — sin esto, Admin y Organizador no
  tienen forma real de autenticarse desde la UI todavía.
- Selector real de lugar/ciudad en "Publicar evento" (hoy es un input de
  texto libre; el backend ya tiene `/api/ciudades/:id/lugares` para esto).
- Módulo de Gamificación — según lo acordado, va después de que el core
  esté publicado.
