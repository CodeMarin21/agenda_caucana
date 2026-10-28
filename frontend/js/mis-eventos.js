/**
 * mis-eventos.js — Dashboard de eventos del organizador.
 *
 * Carga la lista de eventos propios desde GET /api/eventos/mis-eventos,
 * permite filtrar por categoría/fecha/estado y eliminar eventos.
 */
(function () {
  'use strict';

  function obtenerRolDelToken(token) {
    try {
      const payloadCodificado = token.split('.')[1];
      if (!payloadCodificado) return null;
      const base64 = payloadCodificado.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
      return payload.rol || null;
    } catch {
      return null;
    }
  }

  const token = AC_API.getToken();
  if (!token || obtenerRolDelToken(token) !== 'ORGANIZADOR') {
    window.location.replace('../login.html');
    return;
  }

  const cuerpoTabla = document.getElementById('cuerpoTabla');
  const tablaWrap = document.getElementById('tablaWrap');
  const estadoVacio = document.getElementById('estadoVacio');
  const sinResultados = document.getElementById('sinResultados');
  const cargando = document.getElementById('cargando');
  const filtroCategoria = document.getElementById('filtroCategoria');
  const filtroFecha = document.getElementById('filtroFecha');
  const filtroEstado = document.getElementById('filtroEstado');
  const sidebarNombre = document.querySelector('[data-sidebar-nombre]');
  const sidebarInicial = document.querySelector('[data-sidebar-inicial]');

  let eventos = [];
  let categorias = [];
  let redireccionandoPor403 = false;

  /* ── Utilidades ─────────────────────────────────── */

  function manejar403(error) {
    if (error.status !== 403) return false;
    if (!redireccionandoPor403) {
      redireccionandoPor403 = true;
      alert('Tu sesión ha expirado. Vuelve a iniciar sesión.');
      window.location.replace('../login.html');
    }
    return true;
  }

  function escapar(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatearFecha(iso) {
    try {
      return new Date(iso).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
      });
    } catch { return iso; }
  }

  function claseEstado(estado) {
    if (estado === 'APROBADO')  return 'estado estado-aprobado';
    if (estado === 'RECHAZADO') return 'estado estado-rechazado';
    return 'estado estado-pendiente';
  }

  function textoEstado(estado) {
    if (estado === 'APROBADO')  return 'Aprobado';
    if (estado === 'RECHAZADO') return 'Rechazado';
    return 'Pendiente';
  }

  /* ── Carga inicial ──────────────────────────────── */

  async function cargarCategorias() {
    try {
      const respuesta = await AC_API.listarCategorias();
      const lista = Array.isArray(respuesta) ? respuesta
                  : Array.isArray(respuesta?.value) ? respuesta.value
                  : Array.isArray(respuesta?.categorias) ? respuesta.categorias
                  : [];
      categorias = lista;
      filtroCategoria.innerHTML =
        '<option value="">Todas las categorías</option>' +
        lista.map((c) => `<option value="${c.id}">${escapar(c.nombre)}</option>`).join('');
    } catch (e) {
      if (manejar403(e)) return;
      console.warn('No se pudieron cargar categorías:', e.message);
    }
  }

  async function cargarEventos() {
    cargando.hidden = false;
    tablaWrap.hidden = true;
    estadoVacio.hidden = true;
    sinResultados.hidden = true;

    try {
      const respuesta = await AC_API.listarMisEventos();
      eventos = Array.isArray(respuesta) ? respuesta
              : Array.isArray(respuesta?.eventos) ? respuesta.eventos
              : Array.isArray(respuesta?.data) ? respuesta.data
              : [];
      renderizar();
    } catch (error) {
      if (manejar403(error)) return;
      cargando.textContent = `Error al cargar tus eventos: ${error.message}`;
      console.error(error);
    } finally {
      cargando.hidden = true;
    }
  }

  /* ── Filtros ────────────────────────────────────── */

  function aplicarFiltros() {
    const catId = filtroCategoria.value ? Number(filtroCategoria.value) : null;
    const rango = filtroFecha.value;
    const estado = filtroEstado.value;

    const ahora = new Date();
    const en7dias  = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
    const en30dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

    return eventos.filter((ev) => {
      if (catId && ev.categoriaId !== catId && ev.categoria?.id !== catId) return false;
      if (estado && ev.estadoPublicacion !== estado) return false;

      if (rango) {
        const fecha = new Date(ev.fechaInicio);
        if (rango === 'proximos7'  && (fecha < ahora || fecha > en7dias))  return false;
        if (rango === 'proximos30' && (fecha < ahora || fecha > en30dias)) return false;
        if (rango === 'pasados'    && fecha >= ahora)                      return false;
      }
      return true;
    });
  }

  /* ── Render ─────────────────────────────────────── */

  function renderizar() {
    const filtrados = aplicarFiltros();

    if (eventos.length === 0) {
      estadoVacio.hidden = false;
      tablaWrap.hidden = true;
      sinResultados.hidden = true;
      return;
    }

    if (filtrados.length === 0) {
      estadoVacio.hidden = true;
      tablaWrap.hidden = true;
      sinResultados.hidden = false;
      return;
    }

    estadoVacio.hidden = true;
    sinResultados.hidden = true;
    tablaWrap.hidden = false;

    cuerpoTabla.innerHTML = filtrados.map((ev) => `
      <tr data-evento-id="${ev.id}">
        <td class="celda-titulo">${escapar(ev.titulo)}</td>
        <td class="celda-secundaria">${escapar(ev.categoria?.nombre || '—')}</td>
        <td class="celda-secundaria">${formatearFecha(ev.fechaInicio)}</td>
        <td><span class="${claseEstado(ev.estadoPublicacion)}">${textoEstado(ev.estadoPublicacion)}</span></td>
        <td style="text-align:right;">
          <button type="button" class="boton boton-rechazo boton-sm" data-eliminar="${ev.id}">
            Eliminar
          </button>
        </td>
      </tr>
    `).join('');
  }

  /* ── Eliminar evento ────────────────────────────── */

  async function eliminarEvento(id) {
    const ev = eventos.find((e) => e.id === id);
    const titulo = ev ? ev.titulo : 'este evento';
    if (!confirm(`¿Eliminar "${titulo}"?\n\nEsta acción es permanente y no se puede deshacer.`)) {
      return;
    }

    const boton = document.querySelector(`[data-eliminar="${id}"]`);
    if (boton) {
      boton.disabled = true;
      boton.textContent = 'Eliminando...';
    }

    try {
      await AC_API.eliminarEvento(id);
      eventos = eventos.filter((e) => e.id !== id);
      renderizar();
    } catch (error) {
      if (manejar403(error)) return;
      alert(`No se pudo eliminar el evento: ${error.message}`);
      if (boton) {
        boton.disabled = false;
        boton.textContent = 'Eliminar';
      }
    }
  }

  /* ── Info de sidebar (perfil del organizador) ──── */

  async function cargarPerfilSidebar() {
    try {
      const perfil = await AC_API.perfil();
      const nombre = perfil?.organizador?.nombreEntidad || perfil?.nombre || 'Organizador';
      if (sidebarNombre) sidebarNombre.textContent = nombre;
      if (sidebarInicial) sidebarInicial.textContent = nombre.slice(0, 2).toUpperCase();
    } catch (e) {
      if (manejar403(e)) return;
      // silencioso: el sidebar queda con el texto por defecto
    }
  }

  /* ── Eventos ────────────────────────────────────── */

  cuerpoTabla.addEventListener('click', (evento) => {
    const btn = evento.target.closest('[data-eliminar]');
    if (!btn) return;
    eliminarEvento(Number(btn.dataset.eliminar));
  });

  filtroCategoria.addEventListener('change', renderizar);
  filtroFecha.addEventListener('change', renderizar);
  filtroEstado.addEventListener('change', renderizar);

  /* ── Init ───────────────────────────────────────── */

  cargarPerfilSidebar();
  cargarCategorias();
  cargarEventos();
})();