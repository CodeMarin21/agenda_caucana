(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('../login.html')) return;

  const badge = document.querySelector('[data-notificaciones-no-leidas]');
  const lista = document.querySelector('[data-notificaciones-lista]');
  const estado = document.querySelector('[data-notificaciones-estado]');
  const resumen = document.querySelector('[data-notificaciones-resumen]');
  const marcarTodas = document.querySelector('[data-notificaciones-marcar-todas]');
  const cargarMas = document.querySelector('[data-notificaciones-cargar-mas]');
  const botonMenu = document.querySelector('[data-menu-boton]');
  const sidebar = document.querySelector('[data-sidebar]');
  const sidebarNombre = document.querySelector('[data-sidebar-nombre]');
  const sidebarInicial = document.querySelector('[data-sidebar-inicial]');
  const enlacesEspecialidad = document.querySelectorAll('[data-especialidad-link]');
  const enlacesPublicar = document.querySelectorAll('[data-publicar-link]');
  const porPagina = 20;

  let pagina = 0;
  let totalPaginas = 0;
  let noLeidas = 0;
  let cargando = false;

  async function cargarEspecialidad() {
    try {
      const perfil = await AC_API.perfilOrganizador();
      const nombre = perfil.nombreEntidad || 'Organizador';
      if (sidebarNombre) sidebarNombre.textContent = nombre;
      if (sidebarInicial) {
        sidebarInicial.textContent = nombre.trim().split(/\s+/).slice(0, 2)
          .map((parte) => parte[0]).join('').toLocaleUpperCase('es-CO');
      }
      enlacesEspecialidad.forEach((enlace) => {
        enlace.hidden = enlace.dataset.especialidadLink !== perfil.especialidad;
      });
      enlacesPublicar.forEach((enlace) => {
        enlace.hidden = enlace.dataset.especialidadLink !== perfil.especialidad ||
          perfil.vetado ||
          (enlace.dataset.especialidadLink === 'EVENTOS' && perfil.estado !== 'VERIFICADO') ||
          (enlace.dataset.especialidadLink === 'GASTRONOMIA' && perfil.estado === 'SUSPENDIDO');
      });
    } catch (error) {
      if (error.status === 401) {
        window.location.replace('../login.html');
        return;
      }
      console.error('No se pudo cargar la especialidad del organizador.', error);
    }
  }

  const etiquetas = {
    VERIFICACION_APROBADA: 'Organización verificada',
    VERIFICACION_RECHAZADA: 'Revisión de tu organización',
    EVENTO_APROBADO: 'Evento aprobado',
    EVENTO_RECHAZADO: 'Evento rechazado',
    EVENTO_ELIMINADO: 'Evento eliminado',
    NEGOCIO_APROBADO: 'Negocio aprobado',
    NEGOCIO_RECHAZADO: 'Negocio rechazado',
    NEGOCIO_ELIMINADO: 'Negocio eliminado',
    SUSPENSION: 'Aviso sobre tu cuenta',
    REACTIVACION: 'Actualización de tu cuenta',
  };

  function actualizarContador(cantidad) {
    noLeidas = cantidad;
    if (badge) {
      badge.hidden = cantidad === 0;
      badge.textContent = cantidad > 99 ? '99+' : String(cantidad);
      badge.setAttribute('aria-label', `${cantidad} notificaciones sin leer`);
    }
    if (marcarTodas) marcarTodas.hidden = cantidad === 0;
    if (resumen) {
      resumen.textContent = cantidad === 0
        ? 'No tienes avisos pendientes de leer.'
        : `Tienes ${cantidad} ${cantidad === 1 ? 'aviso pendiente' : 'avisos pendientes'} de leer.`;
    }
  }

  async function actualizarContadorDesdeApi() {
    try {
      const resultado = await AC_API.listarNotificaciones(1, 1);
      actualizarContador(resultado.noLeidas || 0);
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) {
        console.error('No se pudo actualizar el contador de notificaciones.', error);
      }
    }
  }

  function fechaLegible(fecha) {
    const date = new Date(fecha);
    if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
    return new Intl.DateTimeFormat('es-CO', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Bogota',
    }).format(date);
  }

  function crearElemento(notificacion) {
    const articulo = document.createElement('article');
    articulo.className = `notificacion-item${notificacion.leida ? ' notificacion-item--leida' : ''}`;

    const contenido = document.createElement('div');
    contenido.className = 'notificacion-item__contenido';

    const cabecera = document.createElement('div');
    cabecera.className = 'notificacion-item__cabecera';
    const titulo = document.createElement('h3');
    titulo.textContent = etiquetas[notificacion.tipo] || 'Aviso de Agenda Caucana';
    cabecera.append(titulo);
    if (!notificacion.leida) {
      const marca = document.createElement('span');
      marca.className = 'notificacion-item__nueva';
      marca.textContent = 'Nueva';
      cabecera.append(marca);
    }

    const mensaje = document.createElement('p');
    mensaje.textContent = notificacion.mensaje;
    const fecha = document.createElement('time');
    fecha.className = 'notificacion-item__fecha';
    fecha.dateTime = notificacion.creadoEn;
    fecha.textContent = fechaLegible(notificacion.creadoEn);
    contenido.append(cabecera, mensaje, fecha);
    articulo.append(contenido);

    if (!notificacion.leida) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton boton-secundario boton-sm notificacion-item__accion';
      boton.dataset.marcarNotificacion = String(notificacion.id);
      boton.textContent = 'Marcar como leída';
      boton.setAttribute('aria-label', `Marcar como leída: ${titulo.textContent}`);
      articulo.append(boton);
    }

    return articulo;
  }

  async function cargarPagina(siguientePagina, anexar) {
    if (!lista || cargando) return;
    cargando = true;
    if (estado) {
      estado.hidden = false;
      estado.textContent = anexar ? 'Cargando más avisos…' : 'Cargando notificaciones…';
    }
    if (cargarMas) cargarMas.disabled = true;

    try {
      const resultado = await AC_API.listarNotificaciones(siguientePagina, porPagina);
      const notificaciones = Array.isArray(resultado.notificaciones)
        ? resultado.notificaciones
        : [];
      if (!anexar) lista.replaceChildren();
      notificaciones.forEach((notificacion) => lista.append(crearElemento(notificacion)));
      pagina = resultado.paginacion?.pagina || siguientePagina;
      totalPaginas = resultado.paginacion?.totalPaginas || 0;
      actualizarContador(resultado.noLeidas || 0);
      if (estado) {
        estado.hidden = notificaciones.length > 0 || pagina > 1;
        estado.textContent = 'Todavía no tienes notificaciones.';
      }
      if (cargarMas) {
        cargarMas.hidden = pagina >= totalPaginas;
        cargarMas.disabled = false;
      }
    } catch (error) {
      if (estado) {
        estado.hidden = false;
        estado.textContent = `No se pudieron cargar las notificaciones: ${error.message}`;
      }
      if (cargarMas) cargarMas.disabled = false;
    } finally {
      cargando = false;
    }
  }

  if (botonMenu && sidebar) {
    botonMenu.addEventListener('click', () => {
      const abierto = sidebar.classList.toggle('abierto');
      botonMenu.setAttribute('aria-expanded', String(abierto));
    });
  }

  if (lista) {
    void cargarPagina(1, false);
    lista.addEventListener('click', async (event) => {
      const boton = event.target.closest('[data-marcar-notificacion]');
      if (!boton) return;
      boton.disabled = true;
      try {
        await AC_API.marcarNotificacionLeida(boton.dataset.marcarNotificacion);
        await cargarPagina(pagina || 1, false);
      } catch (error) {
        boton.disabled = false;
        if (estado) {
          estado.hidden = false;
          estado.textContent = `No se pudo actualizar el aviso: ${error.message}`;
        }
      }
    });
  } else {
    void actualizarContadorDesdeApi();
  }

  if (cargarMas) {
    cargarMas.addEventListener('click', () => {
      void cargarPagina(pagina + 1, true);
    });
  }

  if (marcarTodas) {
    marcarTodas.addEventListener('click', async () => {
      marcarTodas.disabled = true;
      try {
        await AC_API.marcarTodasNotificacionesLeidas();
        await cargarPagina(1, false);
      } catch (error) {
        if (estado) {
          estado.hidden = false;
          estado.textContent = `No se pudieron marcar como leídos los avisos: ${error.message}`;
        }
      } finally {
        marcarTodas.disabled = false;
      }
    });
  }

  void cargarEspecialidad();
})();
