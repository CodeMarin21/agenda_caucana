/**
 * Agenda Caucana — Cliente de la API.
 * Envuelve todos los endpoints documentados del backend (Node/Express/Prisma).
 * El middleware i18n del backend lee el header Accept-Language, así que
 * el idioma elegido en el frontend viaja en cada petición.
 */
const AC_API = (() => {
  const { API_BASE_URL, TOKEN_STORAGE_KEY, LOCALE_STORAGE_KEY, DEFAULT_LOCALE } = window.AC_CONFIG;
  const REFRESH_TOKEN_STORAGE_KEY = 'agendaCaucanaRefreshToken';

  function getToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY) || null;
  }

  function getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || null;
  }

  function getLocale() {
    return localStorage.getItem(LOCALE_STORAGE_KEY) || DEFAULT_LOCALE;
  }

  async function solicitar(ruta, opciones = {}) {
    const headers = {
      'Accept-Language': getLocale(),
      ...(opciones.body ? { 'Content-Type': 'application/json' } : {}),
      ...opciones.headers
    };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let respuesta;
    try {
      respuesta = await fetch(`${API_BASE_URL}${ruta}`, { ...opciones, headers });
    } catch (error) {
      throw new Error('No se pudo conectar con el servidor. ¿Está corriendo el backend?');
    }

    const contentType = respuesta.headers.get('content-type') || '';
    const datos = contentType.includes('application/json') ? await respuesta.json() : null;

    if (!respuesta.ok) {
      let mensaje = `Error ${respuesta.status}`;
      if (datos) {
        if (datos.error) {
          mensaje = datos.error;
        } else if (Array.isArray(datos.errors) && datos.errors.length > 0) {
          mensaje = datos.errors.map((e) => e.msg || e.message || 'Error de validación').join('. ');
        } else if (datos.mensaje || datos.message) {
          mensaje = datos.mensaje || datos.message;
        }
      }
      const error = new Error(mensaje);
      error.status = respuesta.status;
      throw error;
    }
    return datos;
  }

  return {
    // ── Eventos ──────────────────────────────────────────
    listarEventos: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return solicitar(`/eventos${query ? `?${query}` : ''}`);
    },
    obtenerEvento: (slug) => solicitar(`/eventos/${slug}`),
    listarEventosAdminTodos: () => solicitar('/eventos/admin/todos'),
    listarEventosPendientes: () => solicitar('/eventos/admin/pendientes'),
    crearEvento: (payload) => solicitar('/eventos', { method: 'POST', body: JSON.stringify(payload) }),
    aprobarEvento: (id) => solicitar(`/eventos/${id}/aprobar`, { method: 'PATCH' }),
    rechazarEvento: (id, motivo) => solicitar(`/eventos/${id}/rechazar`, { method: 'PATCH', body: JSON.stringify({ motivo }) }),

    // Eventos del organizador logueado
    listarMisEventos: (filtros = {}) => {
      const query = new URLSearchParams(filtros).toString();
      return solicitar(`/eventos/mis-eventos${query ? `?${query}` : ''}`);
    },
    eliminarEvento: (id, motivo) => solicitar(`/eventos/${id}`, {
      method: 'DELETE',
      body: motivo ? JSON.stringify({ motivo }) : undefined
    }),

    // ── Categorías / ciudades ────────────────────────────
    listarCategorias: () => solicitar('/categorias'),
    listarCiudades: () => solicitar('/ciudades'),
    listarLugares: (ciudadId) => solicitar(`/ciudades/${ciudadId}/lugares`),

    // ── Negocios / Sabores ───────────────────────────────
    listarNegocios: (params = {}) => {
      const query = new URLSearchParams(params).toString();
      return solicitar(`/negocios${query ? `?${query}` : ''}`);
    },
    obtenerNegocio: (slug) => solicitar(`/negocios/${encodeURIComponent(slug)}`),
    misNegocios: () => solicitar('/negocios/mis-negocios'),
    listarNegociosAdminTodos: () => solicitar('/negocios/admin/todos'),
    listarNegociosPendientes: () => solicitar('/negocios/admin/pendientes'),
    crearNegocio: (payload) =>
      solicitar('/negocios', { method: 'POST', body: JSON.stringify(payload) }),
    aprobarNegocio: (id) =>
      solicitar(`/negocios/${encodeURIComponent(id)}/aprobar`, { method: 'PATCH' }),
    rechazarNegocio: (id, motivo) =>
      solicitar(`/negocios/${encodeURIComponent(id)}/rechazar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo }),
      }),
    destacarNegocio: (id, destacado) =>
      solicitar(`/negocios/${encodeURIComponent(id)}/destacar`, {
        method: 'PATCH',
        body: JSON.stringify({ destacado }),
      }),
    eliminarNegocio: (id, motivo) => solicitar(`/negocios/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      body: motivo ? JSON.stringify({ motivo }) : undefined
    }),
    calificarNegocio: (id, estrellas, comentario) =>
      solicitar(`/negocios/${id}/calificar`, {
        method: 'POST',
        body: JSON.stringify({ estrellas, comentario }),
      }),

    // ── Organizadores ────────────────────────────────────
    registrarOrganizador: (payload) => solicitar('/organizadores/registro', { method: 'POST', body: JSON.stringify(payload) }),
    listarOrganizadores: () => solicitar('/organizadores'),
    listarOrganizadoresPendientes: () => solicitar('/organizadores/pendientes'),
    verificarOrganizador: (id) => solicitar(`/organizadores/${id}/verificar`, { method: 'PATCH' }),
    suspenderOrganizador: (id, motivo, detalle) =>
      solicitar(`/organizadores/${id}/suspender`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo, detalle })
      }),
    vetarOrganizador: (id, motivo, detalle) =>
      solicitar(`/organizadores/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ motivo, detalle })
      }),
    reactivarOrganizador: (id, motivo, detalle, notificar = true) =>
      solicitar(`/organizadores/${id}/reactivar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo, detalle, notificar })
      }),

    // Perfil del organizador logueado
    perfilOrganizador: () => solicitar('/organizadores/perfil'),
    actualizarPerfilOrganizador: (payload) =>
      solicitar('/organizadores/perfil', { method: 'PATCH', body: JSON.stringify(payload) }),

    // ── Auth ─────────────────────────────────────────────
    login: (email, password) => solicitar('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    perfil: () => solicitar('/auth/perfil'),

    registrarJugador: (payload) => solicitar('/auth/registro', { method: 'POST', body: JSON.stringify(payload) }),
    loginJugador: (username, password) => solicitar('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

    solicitarReset: (email) =>
      solicitar('/auth/solicitar-reset', { method: 'POST', body: JSON.stringify({ email }) }),
    confirmarReset: (token, nuevaPassword) =>
      solicitar('/auth/confirmar-reset', { method: 'POST', body: JSON.stringify({ token, nuevaPassword }) }),

    solicitarResetJugador: (username, codigo) =>
      solicitar('/auth/jugador/solicitar-reset', { method: 'POST', body: JSON.stringify({ username, codigo }) }),
    confirmarResetJugador: (resetToken, nuevaPassword) =>
      solicitar('/auth/jugador/confirmar-reset', { method: 'POST', body: JSON.stringify({ resetToken, nuevaPassword }) }),

    // ── Popayán GO ───────────────────────────────────────
    perfilJugador: () => solicitar('/gamificacion/perfil'),
    actualizarPerfilJugador: (payload) => solicitar('/gamificacion/perfil', { method: 'PATCH', body: JSON.stringify(payload) }),
    listarRutasJugador: () => solicitar('/gamificacion/rutas'),
    obtenerRutaJugador: (id) => solicitar(`/gamificacion/rutas/${id}`),
    registrarVisita: (payload) => solicitar('/gamificacion/visitas', { method: 'POST', body: JSON.stringify(payload) }),
    listarLogrosJugador: () => solicitar('/gamificacion/logros'),
    leaderboard: (ciclo) => solicitar(`/gamificacion/leaderboard/${ciclo}`),
    hallOfFame: () => solicitar('/gamificacion/hall-of-fame'),

    obtenerPrivacidad: () => solicitar('/gamificacion/perfil/privacidad'),
    actualizarPrivacidad: (payload) =>
      solicitar('/gamificacion/perfil/privacidad', { method: 'PATCH', body: JSON.stringify(payload) }),

    listarSeguidores: (tipo = 'seguidores', page = 1) =>
      solicitar(`/gamificacion/seguidores?tipo=${tipo}&page=${page}`),
    seguir: (usuarioId) => solicitar(`/gamificacion/seguir/${usuarioId}`, { method: 'POST' }),
    dejarDeSeguir: (usuarioId) => solicitar(`/gamificacion/seguir/${usuarioId}`, { method: 'DELETE' }),

    // ── Upload ───────────────────────────────────────────
    subirImagen: async (file, carpeta = 'eventos') => {
      const formData = new FormData();
      formData.append('file', file);

      const headers = { 'Accept-Language': getLocale() };
      const token = getToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      let respuesta;
      try {
        respuesta = await fetch(`${API_BASE_URL}/upload/imagen?carpeta=${carpeta}`, {
          method: 'POST',
          headers,
          body: formData,
        });
      } catch {
        throw new Error('No se pudo conectar con el servidor.');
      }

      const datos = await respuesta.json().catch(() => null);
      if (!respuesta.ok) {
        const mensaje = (datos && (datos.error || datos.mensaje)) || `Error ${respuesta.status}`;
        const error = new Error(mensaje);
        error.status = respuesta.status;
        throw error;
      }
      return datos;
    },

    // ── Suscripciones ────────────────────────────────────
    suscribirse: (payload) => solicitar('/suscripciones', { method: 'POST', body: JSON.stringify(payload) }),
    cancelarSuscripcion: (payload) => solicitar('/suscripciones', { method: 'DELETE', body: JSON.stringify(payload) }),

    // ── Chat IA ──────────────────────────────────────────
    preguntar: (pregunta) => solicitar('/chat', { method: 'POST', body: JSON.stringify({ pregunta }) }),

    // ── Utilidades ───────────────────────────────────────
    getLocale,
    setLocale: (locale) => localStorage.setItem(LOCALE_STORAGE_KEY, locale),
    getToken,
    setToken: (token) => localStorage.setItem(TOKEN_STORAGE_KEY, token),
    getRefreshToken,

    cerrarSesion: async () => {
      const refreshToken = getRefreshToken();
      try {
        if (refreshToken) {
          await fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept-Language': getLocale(),
            },
            body: JSON.stringify({ refreshToken }),
          });
        }
      } catch {
        // Si el backend no responde, igual limpiamos localmente.
      } finally {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      }
    }
  };
})();