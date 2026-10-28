/**
 * Agenda Caucana — Panel Admin.
 * Carga dinámica desde el backend:
 *   - Organizadores (todos) → /api/organizadores
 *   - Eventos pendientes    → /api/eventos/admin/pendientes
 *   - Métricas del resumen  → derivadas de los endpoints anteriores
 *
 * El logout lo maneja auth.js vía [data-logout].
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('../login.html')) return;

  // ── Helpers ────────────────────────────────────────────
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const fmtFecha = (iso) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-CO', {
        day: '2-digit', month: 'short', year: 'numeric',
        timeZone: 'America/Bogota'
      });
    } catch { return '—'; }
  };

  const badgeEstado = (estado, vetado = false) => {
    if (vetado) return '<span class="estado estado-suspendido">Vetado</span>';
    const mapa = {
      PENDIENTE:  'estado-pendiente',
      VERIFICADO: 'estado-verificado',
      SUSPENDIDO: 'estado-suspendido',
      RECHAZADO: 'estado-suspendido',
      EN_REVISION: 'estado-pendiente'
    };
    const label = {
      PENDIENTE: 'Pendiente',
      VERIFICADO: 'Verificado',
      SUSPENDIDO: 'Suspendido',
      RECHAZADO: 'Rechazado',
      EN_REVISION: 'En revisión'
    };
    return `<span class="estado ${mapa[estado] || ''}">${label[estado] || estado}</span>`;
  };

  const apiArray = async (metodo) => {
    const resp = await metodo();
    if (Array.isArray(resp)) return resp;
    if (resp && Array.isArray(resp.value)) return resp.value;
    if (resp && Array.isArray(resp.data)) return resp.data;
    return [];
  };

  // ── Sidebar móvil ──────────────────────────────────────
  const botonMenu = document.querySelector('[data-menu-boton]');
  const sidebar = document.querySelector('[data-sidebar]');
  if (botonMenu && sidebar) {
    botonMenu.addEventListener('click', () => sidebar.classList.toggle('abierto'));
  }

  // ══════════════════════════════════════════════════════
  // PÁGINA: organizadores.html
  // ══════════════════════════════════════════════════════
  const tablaOrg = document.querySelector('[data-tabla-organizadores]');
  if (tablaOrg) {
    const tbody = tablaOrg.querySelector('tbody');
    const inputBuscar = document.querySelector('[data-buscar-organizador]');
    let organizadores = [];

    const renderOrganizadores = (lista) => {
      if (lista.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="tabla__vacio">No hay organizadores registrados.</td></tr>';
        return;
      }
      tbody.innerHTML = lista.map((o) => {
        const botones = [];
        botones.push(`<button class="boton boton-sm boton-secundario" data-accion="detalle" data-id="${o.id}">Ver detalle</button>`);
        if (o.vetado) {
          botones.push(`<button class="boton boton-sm boton-primario" data-accion="reactivar-veto" data-id="${o.id}">Reactivar</button>`);
        } else if (o.estado === 'PENDIENTE' || o.estado === 'EN_REVISION') {
          botones.push(`<button class="boton boton-sm boton-rechazo" data-accion="suspender" data-id="${o.id}">Rechazar</button>`);
          botones.push(`<button class="boton boton-sm boton-primario" data-accion="verificar" data-id="${o.id}">Verificar</button>`);
        } else if (o.estado === 'VERIFICADO') {
          botones.push(`<button class="boton boton-sm boton-rechazo" data-accion="suspender" data-id="${o.id}">Suspender</button>`);
        } else if (o.estado === 'SUSPENDIDO') {
          botones.push(`<button class="boton boton-sm boton-primario" data-accion="verificar" data-id="${o.id}">Reactivar</button>`);
        }
        if (!o.vetado) {
          botones.push(`<button class="boton boton-sm boton-rechazo" data-accion="vetar" data-id="${o.id}">Vetar</button>`);
        }
        const eventos = o._count?.eventos ?? 0;
        return `
          <tr data-id="${o.id}">
            <td class="celda-titulo">
              ${esc(o.nombreEntidad)}
              <span class="celda-subtitulo">${eventos} evento${eventos === 1 ? '' : 's'} publicado${eventos === 1 ? '' : 's'}</span>
            </td>
            <td class="celda-secundaria">${esc(o.usuario?.email || '—')}</td>
            <td class="celda-secundaria">${fmtFecha(o.creadoEn)}</td>
            <td>${badgeEstado(o.estado, o.vetado)}</td>
            <td class="columna-acciones">${botones.join(' ')}</td>
          </tr>`;
      }).join('');
    };

    const cargarOrganizadores = async () => {
      tbody.innerHTML = '<tr><td colspan="5" class="tabla__cargando">Cargando organizadores…</td></tr>';
      try {
        organizadores = await apiArray(() => AC_API.listarOrganizadores());
        renderOrganizadores(organizadores);
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="tabla__error">No se pudieron cargar los organizadores: ${esc(error.message)}</td></tr>`;
      }
    };

    if (inputBuscar) {
      inputBuscar.addEventListener('input', () => {
        const q = inputBuscar.value.trim().toLowerCase();
        const filtrado = !q ? organizadores : organizadores.filter((o) =>
          (o.nombreEntidad || '').toLowerCase().includes(q) ||
          (o.usuario?.email || '').toLowerCase().includes(q) ||
          (o.usuario?.nombre || '').toLowerCase().includes(q)
        );
        renderOrganizadores(filtrado);
      });
    }

    // ── Modal de detalle ─────────────────────────────────
    const modal = document.querySelector('[data-modal-detalle]');
    const motivosAdmin = {
      rechazar: [
        ['INFORMACION_INCOMPLETA', 'Información incompleta'],
        ['DOCUMENTO_NO_VERIFICABLE', 'Documento no verificable'],
        ['ENTIDAD_DUPLICADA', 'Entidad duplicada'],
        ['CONTACTO_DUPLICADO', 'Contacto duplicado'],
        ['DATOS_SOSPECHOSOS', 'Datos sospechosos'],
        ['TYC_INCUMPLIDOS', 'Términos y condiciones incumplidos'],
        ['OTRO', 'Otro (especificar)']
      ],
      suspender: [
        ['EVENTO_FALSO', 'Evento falso'],
        ['CONTENIDO_INAPROPIADO', 'Contenido inapropiado'],
        ['QUEJAS_USUARIOS', 'Quejas de usuarios'],
        ['INACTIVIDAD', 'Inactividad (más de 90 días)'],
        ['SOLICITUD_ORGANIZADOR', 'Solicitud del organizador'],
        ['TYC_INCUMPLIDOS', 'Términos y condiciones incumplidos'],
        ['OTRO', 'Otro (especificar)']
      ],
      vetar: [
        ['SUPLANTACION', 'Suplantación comprobada'],
        ['FRAUDE', 'Fraude comprobado'],
        ['MULTIPLES_SUSPENSIONES', 'Múltiples suspensiones'],
        ['ACTIVIDAD_ILEGAL', 'Actividad ilegal'],
        ['DOCUMENTO_FALSIFICADO', 'Documento falsificado'],
        ['TYC_INCUMPLIDOS', 'Términos y condiciones incumplidos'],
        ['OTRO', 'Otro (especificar)']
      ],
      reactivar: [
        ['ERROR_ADMINISTRATIVO', 'El veto anterior fue un error administrativo'],
        ['APELACION_ACEPTADA', 'El organizador apeló y aportó pruebas suficientes'],
        ['SANCION_CUMPLIDA', 'La sanción temporal se cumplió'],
        ['CONDICIONES_CAMBIADAS', 'Cambiaron las condiciones del caso'],
        ['ORDEN_LEGAL', 'Por orden legal o requerimiento de autoridad'],
        ['OTRO', 'Otro (especificar en nota)']
      ]
    };
    const seccionMotivo = modal?.querySelector('[data-modal-motivo]');
    const selectMotivo = modal?.querySelector('[data-modal-motivo-select]');
    const detalleMotivo = modal?.querySelector('[data-modal-motivo-detalle]');
    const inputDetalleMotivo = modal?.querySelector('[data-modal-detalle-input]');
    const notificarWrap = modal?.querySelector('[data-modal-notificar-wrap]');
    const checkNotificar = modal?.querySelector('[data-modal-notificar]');
    const botonConfirmarMotivo = modal?.querySelector('[data-modal-motivo-confirmar]');
    let organizadorSeleccionado = null;
    let accionMotivo = null;

    const mostrarSelectorMotivo = (organizador, accion) => {
      if (!modal || !seccionMotivo || !selectMotivo) return;
      organizadorSeleccionado = organizador;
      accionMotivo = accion;
      selectMotivo.innerHTML = '<option value="">Selecciona un motivo</option>' +
        motivosAdmin[accion].map(([valor, etiqueta]) =>
          `<option value="${valor}">${esc(etiqueta)}</option>`
        ).join('');
      if (inputDetalleMotivo) inputDetalleMotivo.value = '';
      if (detalleMotivo) detalleMotivo.hidden = accion !== 'reactivar';
      if (inputDetalleMotivo) inputDetalleMotivo.required = false;
      if (notificarWrap) notificarWrap.hidden = accion !== 'reactivar';
      if (checkNotificar) checkNotificar.checked = true;
      seccionMotivo.hidden = false;
    };

    const abrirModal = (o) => {
      if (!modal) return;
      organizadorSeleccionado = o;
      accionMotivo = null;
      if (seccionMotivo) seccionMotivo.hidden = true;
      const redes = o.redesSociales && typeof o.redesSociales === 'object'
        ? Object.entries(o.redesSociales).filter(([, v]) => v)
        : [];
      const filas = [
        ['Entidad',        o.nombreEntidad],
        ['Contacto',       o.usuario?.nombre],
        ['Email',          o.usuario?.email],
        ['Teléfono',       o.telefono],
        ['NIT',            o.nit],
        ['Motivo de estado', o.detalleMotivoEstado || o.motivoEstado],
        ['Descripción',    o.descripcion],
        ['Estado',         null, badgeEstado(o.estado, o.vetado)],
        ['Registrado',     fmtFecha(o.creadoEn)],
        ['Eventos',        (o._count?.eventos ?? 0) + ' publicado(s)']
      ].filter(([, v, html]) => html || (v !== null && v !== undefined && v !== ''));

      const avatar = o.avatarUrl
        ? `<img class="modal-detalle__avatar" src="${esc(o.avatarUrl)}" alt="Avatar de ${esc(o.nombreEntidad)}">`
        : `<div class="modal-detalle__avatar modal-detalle__avatar--vacio">${esc((o.nombreEntidad || '?')[0].toUpperCase())}</div>`;

      const redesHtml = redes.length
        ? `<ul class="modal-detalle__redes">${redes.map(([k, v]) =>
            `<li><strong>${esc(k)}:</strong> <a href="${esc(v)}" target="_blank" rel="noopener">${esc(v)}</a></li>`
          ).join('')}</ul>`
        : '<p class="modal-detalle__vacio">Sin redes sociales registradas.</p>';

      modal.querySelector('[data-modal-titulo]').textContent = o.nombreEntidad || 'Detalle del organizador';
      modal.querySelector('[data-modal-cuerpo]').innerHTML = `
        <div class="modal-detalle__cabecera">${avatar}</div>
        <dl class="modal-detalle__lista">
          ${filas.map(([k, v, html]) =>
            `<dt>${esc(k)}</dt><dd>${html || esc(v)}</dd>`
          ).join('')}
        </dl>
        <h3 class="modal-detalle__subtitulo">Redes sociales</h3>
        ${redesHtml}
      `;

      modal.hidden = false;
    };

    if (modal) {
      selectMotivo?.addEventListener('change', () => {
        const esOtro = selectMotivo.value === 'OTRO';
        if (detalleMotivo) detalleMotivo.hidden = !esOtro && accionMotivo !== 'reactivar';
        if (inputDetalleMotivo) inputDetalleMotivo.required = esOtro;
      });
      modal.querySelector('[data-modal-motivo-cancelar]')?.addEventListener('click', () => {
        if (organizadorSeleccionado) abrirModal(organizadorSeleccionado);
      });
      botonConfirmarMotivo?.addEventListener('click', async () => {
        if (!organizadorSeleccionado || !accionMotivo || !selectMotivo?.value) {
          alert('Selecciona un motivo para continuar.');
          return;
        }
        const motivo = selectMotivo.value;
        const detalle = inputDetalleMotivo?.value.trim() || undefined;
        if (motivo === 'OTRO' && (!detalle || detalle.length < 5)) {
          alert('Especifica el motivo con al menos 5 caracteres.');
          inputDetalleMotivo?.focus();
          return;
        }
        botonConfirmarMotivo.disabled = true;
        try {
          if (accionMotivo === 'reactivar') {
            await AC_API.reactivarOrganizador(
              organizadorSeleccionado.id,
              motivo,
              detalle,
              checkNotificar?.checked ?? true
            );
          } else if (accionMotivo === 'vetar') {
            await AC_API.vetarOrganizador(organizadorSeleccionado.id, motivo, detalle);
          } else {
            await AC_API.suspenderOrganizador(organizadorSeleccionado.id, motivo, detalle);
          }
          modal.hidden = true;
          await cargarOrganizadores();
        } catch (error) {
          alert(`No se pudo completar la acción: ${error.message}`);
        } finally {
          botonConfirmarMotivo.disabled = false;
        }
      });
      modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-modal-cerrar]') || e.target === modal) {
          modal.hidden = true;
        }
      });
    }

    // ── Delegación de clicks en la tabla + modal ─────────
    const accion = async (tipo, id, origenBoton) => {
      origenBoton.disabled = true;
      try {
        if (tipo === 'verificar') {
          await AC_API.verificarOrganizador(id);
        } else if (tipo === 'detalle') {
          const o = organizadores.find((x) => x.id === Number(id));
          if (o) abrirModal(o);
          origenBoton.disabled = false;
          return;
        } else if (tipo === 'suspender' || tipo === 'vetar' || tipo === 'reactivar-veto') {
          const o = organizadores.find((x) => x.id === Number(id));
          if (o) {
            abrirModal(o);
            mostrarSelectorMotivo(o, tipo === 'suspender'
              ? (o.estado === 'PENDIENTE' || o.estado === 'EN_REVISION' ? 'rechazar' : 'suspender')
              : tipo === 'vetar' ? 'vetar' : 'reactivar');
          }
          origenBoton.disabled = false;
          return;
        }
        if (modal) modal.hidden = true;
        await cargarOrganizadores();
      } catch (error) {
        alert(`No se pudo completar la acción: ${error.message}`);
        origenBoton.disabled = false;
      }
    };

    document.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion][data-id]');
      if (!boton) return;
      const id = boton.dataset.id;
      if (!id) return;
      accion(boton.dataset.accion, id, boton);
    });

    cargarOrganizadores();
  }

  // ══════════════════════════════════════════════════════
  // PÁGINA: eventos.html
  // ══════════════════════════════════════════════════════
  const tablaEventos = document.querySelector('[data-tabla-eventos]');
  if (tablaEventos) {
    const tbody = tablaEventos.querySelector('tbody');
    const botonesTab = [...document.querySelectorAll('[data-tab-eventos]')];
    const busquedaEventos = document.querySelector('#busquedaEventos');
    const modalDetalle = document.querySelector('[data-modal-detalle-evento]');
    const contenidoDetalle = document.querySelector('[data-contenido-detalle-evento]');
    const modalMotivo = document.querySelector('[data-modal-motivo-evento]');
    const selectMotivo = modalMotivo?.querySelector('[data-modal-motivo-evento-select]');
    const detalleMotivo = modalMotivo?.querySelector('[data-modal-motivo-evento-detalle]');
    const textareaMotivo = modalMotivo?.querySelector('[data-modal-motivo-evento-textarea]');
    const confirmarMotivo = modalMotivo?.querySelector('[data-modal-motivo-evento-confirmar]');
    const modalEliminar = document.querySelector('[data-modal-eliminar-evento]');
    const selectMotivoEliminar = modalEliminar?.querySelector('[data-modal-eliminar-evento-select]');
    const detalleMotivoEliminar = modalEliminar?.querySelector('[data-modal-eliminar-evento-detalle]');
    const textareaMotivoEliminar = modalEliminar?.querySelector('[data-modal-eliminar-evento-textarea]');
    const confirmarEliminar = modalEliminar?.querySelector('[data-modal-eliminar-evento-confirmar]');
    const motivosEvento = [
      ['INFORMACION_INCOMPLETA', 'Información del evento incompleta'],
      ['INFORMACION_FALSA', 'Información falsa o engañosa'],
      ['IMAGEN_INAPROPIADA', 'Imagen inapropiada'],
      ['CONTENIDO_INAPROPIADO', 'Contenido inapropiado'],
      ['DUPLICADO', 'Evento duplicado'],
      ['FUERA_DE_POLITICAS', 'Fuera de políticas de la plataforma'],
      ['OTRO', 'Otro (especificar)']
    ];
    let todosLosEventos = [];
    let organizadoresPorId = new Map();
    let tabActivo = 'PENDIENTE';
    let temporizadorBusquedaEventos;
    let eventoSeleccionado = null;
    let accionMotivoEvento = 'rechazar';

    const obtenerEventos = async (metodo) => {
      const respuesta = await metodo();
      if (Array.isArray(respuesta)) return respuesta;
      if (respuesta && Array.isArray(respuesta.eventos)) return respuesta.eventos;
      if (respuesta && Array.isArray(respuesta.data)) return respuesta.data;
      if (respuesta && Array.isArray(respuesta.value)) return respuesta.value;
      return [];
    };

    const formatearFechaCompleta = (valor) => {
      if (!valor) return '—';
      const fecha = new Date(valor);
      if (Number.isNaN(fecha.getTime())) return '—';
      return fecha.toLocaleString('es-CO', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'America/Bogota'
      });
    };

    const formatearPrecioEvento = (precio) => {
      if (precio === null || precio === undefined || precio === '') return 'Entrada libre';
      const valor = Number(precio);
      return Number.isFinite(valor) && valor > 0
        ? `$${valor.toLocaleString('es-CO')} COP`
        : 'Entrada libre';
    };

    const urlImagenEvento = (url) => {
      if (!url) return '';
      return String(url).replace(
        '/upload/',
        '/upload/w_1200,c_limit,q_auto,f_auto/'
      );
    };

    const badgeEstadoEvento = (estado) => {
      const estilos = {
        PENDIENTE: 'estado-pendiente',
        APROBADO: 'estado-aprobado',
        RECHAZADO: 'estado-rechazado'
      };
      const etiquetas = {
        PENDIENTE: 'Pendiente',
        APROBADO: 'Aprobado',
        RECHAZADO: 'Rechazado'
      };
      return `<span class="estado ${estilos[estado] || ''}">${etiquetas[estado] || esc(estado || '—')}</span>`;
    };

    const datosMotivo = (select, textarea) => {
      const valor = select?.value;
      if (!valor) {
        alert('Selecciona un motivo para continuar.');
        select?.focus();
        return null;
      }
      if (valor === 'OTRO') {
        const detalle = textarea?.value.trim() || '';
        if (detalle.length < 5) {
          alert('Especifica el motivo con al menos 5 caracteres.');
          textarea?.focus();
          return null;
        }
        return detalle;
      }
      return motivosEvento.find(([codigo]) => codigo === valor)?.[1] || valor;
    };

    const actualizarTabs = () => {
      const conteos = {
        TODOS: todosLosEventos.length,
        PENDIENTE: todosLosEventos.filter((ev) => ev.estadoPublicacion === 'PENDIENTE').length,
        APROBADO: todosLosEventos.filter((ev) => ev.estadoPublicacion === 'APROBADO').length,
        RECHAZADO: todosLosEventos.filter((ev) => ev.estadoPublicacion === 'RECHAZADO').length
      };
      Object.entries(conteos).forEach(([estado, conteo]) => {
        const elemento = document.querySelector(`[data-conteo-estado="${estado}"]`);
        if (elemento) elemento.textContent = String(conteo);
      });
      botonesTab.forEach((boton) => {
        boton.setAttribute('aria-pressed', String(boton.dataset.tabEventos === tabActivo));
      });
    };

    const eventosDelTab = () => tabActivo === 'TODOS'
      ? todosLosEventos
      : todosLosEventos.filter((ev) => ev.estadoPublicacion === tabActivo);

    const normalizarBusqueda = (valor) => String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('es-CO')
      .trim();

    const botonesPorEstado = (evento) => {
      const id = esc(evento.id);
      const botones = [`<button type="button" class="boton boton-sm boton-secundario" data-accion-evento="detalle" data-id="${id}">Ver detalle</button>`];
      if (evento.estadoPublicacion === 'PENDIENTE') {
        botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-evento="rechazar" data-id="${id}">Rechazar</button>`);
        botones.push(`<button type="button" class="boton boton-sm boton-primario" data-accion-evento="aprobar" data-id="${id}">Aprobar</button>`);
      } else if (evento.estadoPublicacion === 'APROBADO') {
        botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-evento="suspender" data-id="${id}">Suspender</button>`);
        botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-evento="eliminar" data-id="${id}">Eliminar</button>`);
      } else if (evento.estadoPublicacion === 'RECHAZADO') {
        botones.push(`<button type="button" class="boton boton-sm boton-primario" data-accion-evento="aprobar" data-id="${id}">Aprobar</button>`);
        botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-evento="eliminar" data-id="${id}">Eliminar</button>`);
      }
      return botones.join(' ');
    };

    const renderEventos = () => {
      const consulta = normalizarBusqueda(busquedaEventos?.value);
      const lista = eventosDelTab().filter((evento) =>
        normalizarBusqueda(evento.titulo).includes(consulta)
      );
      actualizarTabs();
      if (lista.length === 0) {
        const texto = consulta
          ? 'No hay eventos que coincidan con la búsqueda en este filtro.'
          : tabActivo === 'PENDIENTE'
            ? 'No hay eventos pendientes.'
            : 'No hay eventos para mostrar en este filtro.';
        tbody.innerHTML = `<tr><td colspan="6" class="tabla__vacio">${texto}</td></tr>`;
        return;
      }
      tbody.innerHTML = lista.map((evento) => `
        <tr data-id="${esc(evento.id)}">
          <td class="celda-titulo">
            ${esc(evento.titulo || '—')}
            <span class="celda-subtitulo">${esc(evento.lugar?.nombre || evento.direccion || '—')}</span>
          </td>
          <td class="celda-secundaria">${esc(evento.organizador?.nombreEntidad || organizadoresPorId.get(evento.organizadorId)?.nombreEntidad || (evento.organizadorId ? `Organizador #${evento.organizadorId}` : '—'))}</td>
          <td>${esc(evento.categoria?.nombre || '—')}</td>
          <td class="celda-secundaria">${fmtFecha(evento.fechaInicio)}</td>
          <td>${badgeEstadoEvento(evento.estadoPublicacion)}</td>
          <td class="columna-acciones">${botonesPorEstado(evento)}</td>
        </tr>
      `).join('');
    };

    const cerrarModal = (modal) => {
      if (modal) modal.hidden = true;
    };

    const abrirDetalleEvento = (evento) => {
      if (!modalDetalle || !contenidoDetalle) return;
      const imagen = urlImagenEvento(evento.imagenUrl);
      const enlaceBoletas = evento.urlExternaBoletas
        ? `<a href="${esc(evento.urlExternaBoletas)}" target="_blank" rel="noopener noreferrer">${esc(evento.urlExternaBoletas)}</a>`
        : '—';
      const fechaFin = evento.fechaFin ? formatearFechaCompleta(evento.fechaFin) : '—';
      contenidoDetalle.innerHTML = `
        <div class="modal-eventos__detalle">
          <div>
            ${imagen
              ? `<img class="modal-eventos__imagen" src="${esc(imagen)}" alt="${esc(evento.titulo || 'Imagen del evento')}">`
              : '<div class="modal-eventos__imagen" aria-label="Sin imagen disponible"></div>'}
            <p class="modal-eventos__categoria">${esc(evento.categoria?.nombre || '—')}</p>
            <h3 class="modal-eventos__titulo">${esc(evento.titulo || '—')}</h3>
          </div>
          <div>
            <dl class="modal-eventos__datos">
              <dt>Descripción</dt><dd class="modal-eventos__descripcion">${esc(evento.descripcion || '—')}</dd>
              <dt>Fecha de inicio</dt><dd>${esc(formatearFechaCompleta(evento.fechaInicio))}</dd>
              <dt>Fecha de fin</dt><dd>${esc(fechaFin)}</dd>
              <dt>Precio</dt><dd>${esc(formatearPrecioEvento(evento.precioReferencial))}</dd>
              <dt>Edad</dt><dd>${evento.esMayorDeEdad ? '+18 años' : 'Todas las edades'}</dd>
              <dt>Lugar</dt><dd>${esc(evento.lugar?.nombre || '—')}</dd>
              <dt>Dirección</dt><dd>${esc(evento.direccion || evento.lugar?.direccion || '—')}</dd>
              <dt>Organizador</dt><dd>${esc(evento.organizador?.nombreEntidad || organizadoresPorId.get(evento.organizadorId)?.nombreEntidad || (evento.organizadorId ? `Organizador #${evento.organizadorId}` : '—'))}</dd>
              <dt>URL de ticketera</dt><dd>${enlaceBoletas}</dd>
            </dl>
          </div>
        </div>`;
      modalDetalle.hidden = false;
    };

    const abrirModalMotivoEvento = (evento, accion) => {
      if (!modalMotivo || !selectMotivo) return;
      eventoSeleccionado = evento;
      accionMotivoEvento = accion;
      const titulo = modalMotivo.querySelector('#tituloMotivoEvento');
      if (titulo) titulo.textContent = accion === 'suspender' ? 'Suspender evento' : 'Rechazar evento';
      selectMotivo.value = '';
      if (textareaMotivo) textareaMotivo.value = '';
      if (detalleMotivo) detalleMotivo.hidden = true;
      if (confirmarMotivo) {
        confirmarMotivo.textContent = accion === 'suspender' ? 'Suspender' : 'Rechazar';
        confirmarMotivo.disabled = false;
      }
      modalMotivo.hidden = false;
    };

    const abrirModalEliminarEvento = (evento) => {
      if (!modalEliminar || !selectMotivoEliminar) return;
      eventoSeleccionado = evento;
      selectMotivoEliminar.value = '';
      if (textareaMotivoEliminar) textareaMotivoEliminar.value = '';
      if (detalleMotivoEliminar) detalleMotivoEliminar.hidden = true;
      const confirmacion = modalEliminar.querySelector('[data-confirmacion-eliminar-evento]');
      if (confirmacion) {
        confirmacion.textContent = `¿Eliminar el evento "${evento.titulo}"? Se borrará también la imagen del servidor y el organizador será notificado.`;
      }
      if (confirmarEliminar) confirmarEliminar.disabled = false;
      modalEliminar.hidden = false;
    };

    const cargarEventos = async () => {
      tbody.innerHTML = '<tr><td colspan="6" class="tabla__cargando">Cargando eventos…</td></tr>';
      try {
        const [eventos, organizadores] = await Promise.all([
          obtenerEventos(() => AC_API.listarEventosAdminTodos()),
          apiArray(() => AC_API.listarOrganizadores())
        ]);
        todosLosEventos = eventos;
        organizadoresPorId = new Map(organizadores.map((organizador) => [organizador.id, organizador]));
        renderEventos();
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="tabla__error">No se pudieron cargar los eventos: ${esc(error.message)}</td></tr>`;
      }
    };

    botonesTab.forEach((boton) => {
      boton.addEventListener('click', () => {
        tabActivo = boton.dataset.tabEventos || 'PENDIENTE';
        renderEventos();
      });
    });

    busquedaEventos?.addEventListener('input', () => {
      clearTimeout(temporizadorBusquedaEventos);
      temporizadorBusquedaEventos = setTimeout(renderEventos, 150);
    });

    tbody.addEventListener('click', async (eventoClick) => {
      const boton = eventoClick.target.closest('button[data-accion-evento][data-id]');
      if (!boton) return;
      const evento = todosLosEventos.find((item) => String(item.id) === boton.dataset.id);
      if (!evento) return;

      const accion = boton.dataset.accionEvento;
      if (accion === 'detalle') {
        abrirDetalleEvento(evento);
        return;
      }
      if (accion === 'rechazar' || accion === 'suspender') {
        abrirModalMotivoEvento(evento, accion);
        return;
      }
      if (accion === 'eliminar') {
        abrirModalEliminarEvento(evento);
        return;
      }
      if (accion === 'aprobar') {
        boton.disabled = true;
        try {
          await AC_API.aprobarEvento(evento.id);
          await cargarEventos();
        } catch (error) {
          alert(`No se pudo aprobar el evento: ${error.message}`);
          boton.disabled = false;
        }
      }
    });

    selectMotivo?.addEventListener('change', () => {
      const esOtro = selectMotivo.value === 'OTRO';
      if (detalleMotivo) detalleMotivo.hidden = !esOtro;
      if (textareaMotivo) textareaMotivo.required = esOtro;
    });

    confirmarMotivo?.addEventListener('click', async () => {
      if (!eventoSeleccionado) return;
      const motivo = datosMotivo(selectMotivo, textareaMotivo);
      if (!motivo) return;
      confirmarMotivo.disabled = true;
      try {
        await AC_API.rechazarEvento(eventoSeleccionado.id, motivo);
        cerrarModal(modalMotivo);
        await cargarEventos();
      } catch (error) {
        alert(`No se pudo completar la acción: ${error.message}`);
      } finally {
        confirmarMotivo.disabled = false;
      }
    });

    selectMotivoEliminar?.addEventListener('change', () => {
      const esOtro = selectMotivoEliminar.value === 'OTRO';
      if (detalleMotivoEliminar) detalleMotivoEliminar.hidden = !esOtro;
      if (textareaMotivoEliminar) textareaMotivoEliminar.required = esOtro;
    });

    confirmarEliminar?.addEventListener('click', async () => {
      if (!eventoSeleccionado) return;
      const motivo = datosMotivo(selectMotivoEliminar, textareaMotivoEliminar);
      if (!motivo) return;
      confirmarEliminar.disabled = true;
      try {
        await AC_API.eliminarEvento(eventoSeleccionado.id, motivo);
        cerrarModal(modalEliminar);
        await cargarEventos();
      } catch (error) {
        alert(`No se pudo eliminar el evento: ${error.message}`);
      } finally {
        confirmarEliminar.disabled = false;
      }
    });

    document.querySelectorAll('[data-cerrar-detalle-evento]').forEach((boton) => {
      boton.addEventListener('click', () => cerrarModal(modalDetalle));
    });
    document.querySelectorAll('[data-cerrar-motivo-evento]').forEach((boton) => {
      boton.addEventListener('click', () => cerrarModal(modalMotivo));
    });
    document.querySelectorAll('[data-cerrar-eliminar-evento]').forEach((boton) => {
      boton.addEventListener('click', () => cerrarModal(modalEliminar));
    });
    [modalDetalle, modalMotivo, modalEliminar].forEach((modal) => {
      modal?.addEventListener('click', (eventoClick) => {
        if (eventoClick.target === modal) cerrarModal(modal);
      });
    });

    cargarEventos();
  }

  // ══════════════════════════════════════════════════════
  // PÁGINA: resumen.html
  // ══════════════════════════════════════════════════════
  const metricas = document.querySelector('[data-metrica]');
  if (metricas) {
    // Nombre del admin logueado
    const nombreAdmin = document.querySelector('[data-admin-nombre]');
    AC_API.perfil().then((p) => {
      if (nombreAdmin && p?.usuario?.nombre) {
        nombreAdmin.textContent = `¡Buenas tardes, ${p.usuario.nombre.split(' ')[0]}!`;
      }
    }).catch(() => {});

    Promise.allSettled([
      apiArray(() => AC_API.listarEventosPendientes()),
      apiArray(() => AC_API.listarOrganizadoresPendientes()),
      apiArray(() => AC_API.listarEventosAdminTodos())
    ]).then(([pendientes, orgPend, todos]) => {
      const set = (k, v) => {
        const el = document.querySelector(`[data-metrica="${k}"]`);
        if (el) el.textContent = v;
      };
      set('pendientes', pendientes.status === 'fulfilled' ? pendientes.value.length : '—');
      set('organizadores-pendientes', orgPend.status === 'fulfilled' ? orgPend.value.length : '—');

      if (todos.status === 'fulfilled') {
        const ahora = new Date();
        const mesActual = ahora.getMonth();
        const anioActual = ahora.getFullYear();
        const publicadosMes = todos.value.filter((ev) => {
          if (ev.estadoPublicacion !== 'APROBADO') return false;
          const d = new Date(ev.fechaInicio);
          return d.getMonth() === mesActual && d.getFullYear() === anioActual;
        }).length;
        set('publicados-mes', publicadosMes);
      } else {
        set('publicados-mes', '—');
      }
      // No hay endpoint de "usuarios totales" — lo dejamos como "—"
      set('usuarios', '—');
    });
  }
})();