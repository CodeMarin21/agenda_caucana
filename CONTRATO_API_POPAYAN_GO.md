# Contrato de API — Módulo Popayán Go

**Versión:** 1.0
**Fecha:** Septiembre 2026
**Backend:** http://localhost:3000 (dev)
**Autenticación:** Bearer JWT en header `Authorization`
**Formato:** JSON en request y response

Este contrato es el único documento que necesitas para construir el frontend del módulo Popayán Go. **No adivines nada.** Si algo no está aquí, pregúntale al equipo de backend antes de inventar.

---

## 1. Registro y login de jugador

### POST `/api/auth/registro`

Crea un jugador nuevo. **Sin email** (los jugadores son anónimos según RNF2).

**Request body:**
```json
{
  "username": "explorador_cauca",
  "password": "Secreta123",
  "descripcion": "Cazador de iglesias coloniales",
  "rol": "JUGADOR"
}
```

**Reglas de validación:**
- `username`: 3-30 caracteres, solo letras, números y guion bajo (`[a-zA-Z0-9_]`). Debe ser único.
- `password`: mínimo 8 caracteres, al menos 1 mayúscula, 1 minúscula y 1 número.
- `descripcion` (opcional): máximo 200 caracteres. Es la bio estilo "About Me".
- `rol`: siempre `"JUGADOR"` para este flujo.

**Response 201:**
```json
{
  "mensaje": "Cuenta creada exitosamente",
  "usuario": {
    "id": 15,
    "nombre": "explorador_cauca",
    "email": null,
    "username": "explorador_cauca",
    "rol": "JUGADOR",
    "creadoEn": "2026-09-13T18:00:00.000Z",
    "jugador": {
      "id": 8,
      "avatarUrl": null,
      "descripcion": "Cazador de iglesias coloniales",
      "nivel": 1,
      "puntajeTotal": 0
    }
  }
}
```

**Errores:**
- `400` `{"error": "Ese nombre de usuario ya está en uso"}`
- `400` `{"errors": [{"msg": "El usuario debe tener entre 3 y 30 caracteres", "path": "username"}]}`

### POST `/api/auth/login`

**Request body:**
```json
{ "username": "explorador_cauca", "password": "Secreta123" }
```

**Response 200:**
```json
{
  "mensaje": "Sesión iniciada",
  "usuario": { "id": 15, "username": "explorador_cauca", "rol": "JUGADOR" },
  "tokens": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

**Notas frontend:**
- Guardar ambos tokens (ver `js/auth.js` para convención)
- `accessToken` expira en 7 días
- Añadir `Authorization: Bearer ${accessToken}` en cada llamada protegida
- Si el backend devuelve `401`, intentar `POST /api/auth/refresh`

---

## 2. Perfil del jugador

### GET `/api/gamificacion/perfil` 🔒

**Headers:** `Authorization: Bearer ${accessToken}`

**Response 200:**
```json
{
  "jugadorId": 8,
  "username": "explorador_cauca",
  "nombre": "explorador_cauca",
  "avatarUrl": null,
  "descripcion": "Cazador de iglesias coloniales",
  "nivel": 1,
  "puntajeTotal": 10,
  "puntajeSemanal": 10,
  "puntajeTemporada": 10,
  "progresoGlobal": 5.5,
  "totalVisitas": 1,
  "posicionRanking": 1,
  "logrosRecientes": [
    {
      "id": 1,
      "nombre": "Explorador Novato",
      "icono": "🌱",
      "categoria": "General",
      "descripcionExtra": null,
      "desbloqueadoEn": "2026-09-13T18:05:00.000Z"
    }
  ]
}
```

**Notas UI:**
- `avatarUrl: null` → mostrar avatar por defecto generado (ej: `https://ui-avatars.com/api/?name=explorador_cauca`)
- `descripcionExtra` solo aparece en logros de temporada (ej: "Septiembre 2026")
- `posicionRanking` es la posición en el ranking **semanal**

### PATCH `/api/gamificacion/perfil` 🔒

**Request body:**
```json
{
  "avatarUrl": "https://res.cloudinary.com/.../avatar.jpg",
  "descripcion": "Nueva bio corta"
}
```

Ambos campos opcionales. Solo se actualizan los que envíes.

**Response 200:**
```json
{
  "mensaje": "Perfil actualizado",
  "perfil": { "id": 8, "avatarUrl": "...", "descripcion": "...", "nivel": 1, "puntajeTotal": 10 }
}
```

---

## 3. Catálogo de rutas

### GET `/api/gamificacion/rutas` 🔒

**Response 200:**
```json
{
  "rutas": [
    {
      "id": 1,
      "nombre": "Ruta de las Iglesias",
      "descripcion": "Recorre las 4 iglesias coloniales más emblemáticas de Popayán.",
      "colorTema": "azul",
      "categoria": "iglesias",
      "puntosTotales": 4,
      "puntosVisitados": 1,
      "porcentaje": 25,
      "completada": false
    },
    {
      "id": 2,
      "nombre": "Ruta Histórica",
      "descripcion": "Los hitos históricos que marcaron la Ciudad Blanca.",
      "colorTema": "naranja",
      "categoria": "historica",
      "puntosTotales": 4,
      "puntosVisitados": 0,
      "porcentaje": 0,
      "completada": false
    }
  ]
}
```

**Colores disponibles por `colorTema`:**
- `azul` → `#3b82f6`
- `naranja` → `#f97316`
- `morado` → `#a855f7`
- `rojo` → `#ef4444`

### GET `/api/gamificacion/rutas/:id` 🔒

**Response 200:**
```json
{
  "id": 1,
  "nombre": "Ruta de las Iglesias",
  "descripcion": "...",
  "colorTema": "azul",
  "categoria": "iglesias",
  "porcentaje": 25,
  "completada": false,
  "puntos": [
    {
      "lugarId": 1,
      "nombre": "Catedral Basílica Nuestra Señora de la Asunción",
      "direccion": "Parque Caldas, Centro",
      "descripcion": null,
      "latitud": 2.44191,
      "longitud": -76.60643,
      "radioMetros": 100,
      "orden": 1,
      "visitado": false
    }
  ]
}
```

**Notas UI (mapa con Leaflet.js):**
- Librería: **Leaflet.js** (gratis, sin API key)
- Tiles: **OpenStreetMap** (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`)
- Centro del mapa: `[2.44191, -76.60643]` (Popayán centro), zoom 15
- Cada punto se marca con un pin en `[latitud, longitud]`
- Pines visitados: color verde ✅ / no visitados: gris
- Al hacer click en un pin: abrir modal con `nombre`, `direccion`, `descripcion` + botón "Registrar Visita"
- El botón ejecuta `navigator.geolocation.getCurrentPosition()` y envía POST a `/visitas`

---

## 4. Check-in de visita

### POST `/api/gamificacion/visitas` 🔒

**Headers:** `Authorization: Bearer ${accessToken}`

**Request body:**
```json
{
  "lugarId": 1,
  "latitud": 2.44191,
  "longitud": -76.60643,
  "accuracy": 15
}
```

- `lugarId`: ID del punto (obtenido de `/rutas/:id`)
- `latitud` / `longitud`: GPS actual del usuario vía HTML5 Geolocation
- `accuracy` (opcional): margen de error reportado por el navegador en metros

**Response 201 — primera visita:**
```json
{
  "mensaje": "¡Visita registrada!",
  "visitaId": 42,
  "lugarNombre": "Catedral Basílica Nuestra Señora de la Asunción",
  "puntosGanados": 10,
  "esRevisita": false,
  "logrosDesbloqueados": [
    {
      "id": 1,
      "nombre": "Explorador Novato",
      "descripcion": "Visita tu primer lugar en Popayán Go",
      "icono": "🌱",
      "categoria": "General"
    }
  ],
  "progresoGlobal": 5.5,
  "rutasAfectadas": [
    {
      "rutaId": 1,
      "rutaNombre": "Ruta de las Iglesias",
      "porcentaje": 25,
      "completada": false
    }
  ]
}
```

**Response 201 — re-visita en semana nueva:**
```json
{
  "puntosGanados": 5,
  "esRevisita": true,
  ...
}
```

**Errores (todos 400):**
- `{"error": "El punto de interés no existe o está inactivo"}`
- `{"error": "Estás a 350m del punto. Debes estar a menos de 100m."}`
- `{"error": "Tu GPS tiene un margen de error de ±800m. Sal al aire libre e intenta de nuevo."}`
- `{"error": "Ya registraste una visita en este lugar esta semana"}`
- `{"error": "El punto de interés no tiene coordenadas registradas"}`

**Notas UI (modal de éxito):**
- Título grande: "¡Visita Registrada!"
- Mostrar `lugarNombre`
- Animación con `puntosGanados` (+10 pts o +5 pts)
- Si `logrosDesbloqueados.length > 0`: modal de celebración con icono + nombre de cada logro
- Botones: "Explorar Más Logros" | "Ver Mi Perfil" | "Volver al Inicio"
- Si `esRevisita: true`: mensaje "¡Bienvenido de nuevo!"
- Si `esRevisita: false`: mensaje "¡Primera vez aquí!"

**Código de geolocalización:**
```js
navigator.geolocation.getCurrentPosition(
  (pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    // POST /api/gamificacion/visitas
  },
  (err) => { /* mostrar error */ },
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
);
```
**IMPORTANTE:** `enableHighAccuracy: true` es obligatorio. Sin esto, el GPS da 500m+ de error.

**Requisito HTTPS:** HTML5 Geolocation **NO funciona en HTTP** excepto en `localhost`. En producción debe ser HTTPS (Netlify/Vercel lo dan gratis).

---

## 5. Logros

### GET `/api/gamificacion/logros` 🔒

**Response 200:**
```json
{
  "logros": [
    {
      "id": 1,
      "nombre": "Explorador Novato",
      "descripcion": "Visita tu primer lugar en Popayán Go",
      "icono": "🌱",
      "categoria": "General",
      "meta": 1,
      "desbloqueado": true
    },
    {
      "id": 3,
      "nombre": "Devoto Colonial",
      "descripcion": "Visita 2 iglesias históricas",
      "icono": "⛪",
      "categoria": "iglesias",
      "meta": 2,
      "desbloqueado": false
    }
  ]
}
```

**Categorías posibles:** `General`, `iglesias`, `historica`, `gastronomia`, `cultural`, `Temporada`.

**Notas UI (galería de logros):**
- Dos secciones: "Colección de Logros" (desbloqueados) y "Por Desbloquear"
- Desbloqueados: opacos/brightness normal, con fecha de desbloqueo
- Por desbloquear: semitransparentes (`opacity: 0.4`), con `meta` visible (ej: "Visita 2 iglesias")
- Logros de temporada aparecen al final con `descripcionExtra` (ej: "Septiembre 2026")

---

## 6. Leaderboards (públicos, sin auth)

### GET `/api/gamificacion/leaderboard/semanal`

**Response 200:**
```json
{
  "ciclo": "semanal",
  "reinicia": "Domingos 12:00 PM (Bogotá)",
  "top": [
    {
      "posicion": 1,
      "jugadorId": 8,
      "username": "explorador_cauca",
      "nombre": "explorador_cauca",
      "avatarUrl": null,
      "nivel": 1,
      "puntajeSemanal": 25,
      "puntajeTotal": 45
    }
  ]
}
```

### GET `/api/gamificacion/leaderboard/temporada`

Misma estructura, campo `puntajeTemporada`, reinicia "Primer domingo del mes a las 12:05 PM (Bogotá)".

**Notas UI:**
- Dos pestañas: "Semanal" / "Temporada"
- Top 3 con estilo especial (🥇🥈🥉)
- Mostrar `avatarUrl` o avatar por defecto

---

## 7. Hall of Fame

### GET `/api/gamificacion/hall-of-fame`

Lista de temporadas cerradas (aún vacío — primera cerrará el 1er domingo del mes).

**Response 200:**
```json
{
  "temporadas": [
    {
      "id": 1,
      "numero": 1,
      "nombre": "Temporada 1 — Septiembre 2026",
      "fechaInicio": "2026-09-01T05:00:00.000Z",
      "fechaFin": "2026-09-30T04:59:59.999Z"
    }
  ]
}
```

### GET `/api/gamificacion/hall-of-fame/:temporadaId`

**Response 200:**
```json
{
  "temporada": { "id": 1, "numero": 1, "nombre": "Temporada 1 — Septiembre 2026", ... },
  "top": [
    {
      "posicion": 1,
      "jugadorId": 8,
      "username": "explorador_cauca",
      "nombre": "explorador_cauca",
      "avatarUrl": null,
      "nivel": 5,
      "puntajeTemporada": 450,
      "visitasTemporada": 32
    }
  ]
}
```

**Notas UI:**
- Top 1: corona dorada 👑
- Top 2-5: estilo plateado
- Top 6-50: estilo normal

---

## 8. Rate limits

- **Check-in:** 30 requests / 10 min por usuario autenticado
- **Leaderboards y Hall of Fame:** 60 requests / minuto por IP
- **Chat IA:** 20 requests / 10 min por IP

Si el frontend recibe `429`, mostrar: "Demasiadas consultas, espera unos segundos".

---

## 9. i18n — Multi-idioma

Los textos estáticos del frontend vienen de `frontend/locales/{es,en,fr}.json`.

**Los nombres de lugares y rutas NO se traducen** — son datos de BD en español. El backend no tiene columnas `nombre_en` ni similares.

El chatbot IA sí responde en el idioma que se le pida vía el campo `idioma`.

---

## 10. Resumen de endpoints

| Método | Endpoint | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro` | No | Crear jugador |
| POST | `/api/auth/login` | No | Login con username |
| GET | `/api/gamificacion/perfil` | JUGADOR | Perfil del jugador |
| PATCH | `/api/gamificacion/perfil` | JUGADOR | Actualizar avatar/bio |
| GET | `/api/gamificacion/rutas` | JUGADOR | Catálogo de rutas |
| GET | `/api/gamificacion/rutas/:id` | JUGADOR | Detalle + puntos |
| POST | `/api/gamificacion/visitas` | JUGADOR | Check-in con GPS |
| GET | `/api/gamificacion/logros` | JUGADOR | Catálogo de logros |
| GET | `/api/gamificacion/leaderboard/semanal` | Público | Top 50 semanal |
| GET | `/api/gamificacion/leaderboard/temporada` | Público | Top 50 temporada |
| GET | `/api/gamificacion/hall-of-fame` | Público | Lista de temporadas cerradas |
| GET | `/api/gamificacion/hall-of-fame/:id` | Público | Top 50 de una temporada |