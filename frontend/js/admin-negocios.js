/**
 * Agenda Caucana — Moderación administrativa de negocios.
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('../login.html')) return;

  const tabla = document.querySelector('[data-tabla-negocios]');
  if (!tabla) return;

  const tbody = tabla.querySelector('tbody');
  const tabs = [...document.querySelectorAll('[data-tab-negocios]')];
  const busquedaNegocios = document.querySelector('#busquedaNegocios');
  const modalDetalle = document.querySelector('[data-modal-detalle-negocio]');
  const contenidoDetalle = document.querySelector('[data-contenido-detalle-negocio]');
  const modalMotivo = document.querySelector('[data-modal-motivo-negocio]');
  const selectMotivo = modalMotivo?.querySelector('[data-motivo-negocio-select]');
  const detalleMotivo = modalMotivo?.querySelector('[data-motivo-negocio-detalle]');
  const textareaMotivo = modalMotivo?.querySelector('[data-motivo-negocio-textarea]');
  const tituloMotivo = modalMotivo?.querySelector('#tituloMotivoNegocio');
  const confirmacionMotivo = modalMotivo?.querySelector('[data-confirmacion-motivo-negocio]');
  const botonConfirmar = modalMotivo?.querySelector('[data-confirmar-motivo-negocio]');
  const menu = document.querySelector('[data-menu-boton]');
  const sidebar = document.querySelector('[data-sidebar]');

  const escapar = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caracter) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[caracter]
  ));

  const fecha = (valor) => {
    if (!valor) return '—';
    const date = new Date(valor);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Bogota'
    });
  };

  const urlSegura = (valor) => {
    if (typeof valor !== 'string') return '';
    try {
      const url = new URL(valor, window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  };

  const etiquetaEstado = (estado) => {
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
    return `<span class="estado ${estilos[estado] || ''}">${etiquetas[estado] || escapar(estado || '—')}</span>`;
  };

  const extraerNegocios = (respuesta) => {
    if (Array.isArray(respuesta)) return respuesta;
    throw new Error('La respuesta del servidor no tiene el formato esperado.');
  };

  let negocios = [];
  let tabActivo = 'PENDIENTE';
  let temporizadorBusquedaNegocios;
  let negocioSeleccionado = null;
  let accionMotivo = null;

  const negociosDelTab = () => tabActivo === 'TODOS'
    ? negocios
    : negocios.filter((negocio) => negocio.estadoPublicacion === tabActivo);

  const normalizarBusqueda = (valor) => String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-CO')
    .trim();

  const botonesDeAccion = (negocio) => {
    const id = escapar(negocio.id);
    const botones = [
      `<button type="button" class="boton boton-sm boton-secundario" data-accion-negocio="detalle" data-id="${id}">Ver detalle</button>`
    ];
    if (negocio.estadoPublicacion === 'PENDIENTE' || negocio.estadoPublicacion === 'RECHAZADO') {
      botones.push(`<button type="button" class="boton boton-sm boton-primario" data-accion-negocio="aprobar" data-id="${id}">Aprobar</button>`);
    }
    if (negocio.estadoPublicacion === 'PENDIENTE') {
      botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-negocio="rechazar" data-id="${id}">Rechazar</button>`);
    }
    if (negocio.estadoPublicacion === 'APROBADO') {
      const texto = negocio.destacado ? 'Quitar destacado' : 'Destacar';
      botones.push(`<button type="button" class="boton boton-sm boton-secundario" data-accion-negocio="destacar" data-id="${id}" data-destacado="${String(!negocio.destacado)}">${texto}</button>`);
    }
    botones.push(`<button type="button" class="boton boton-sm boton-rechazo" data-accion-negocio="eliminar" data-id="${id}">Eliminar</button>`);
    return botones.join(' ');
  };

  const renderizar = () => {
    const conteos = {
      TODOS: negocios.length,
      PENDIENTE: negocios.filter((negocio) => negocio.estadoPublicacion === 'PENDIENTE').length,
      APROBADO: negocios.filter((negocio) => negocio.estadoPublicacion === 'APROBADO').length,
      RECHAZADO: negocios.filter((negocio) => negocio.estadoPublicacion === 'RECHAZADO').length
    };
    Object.entries(conteos).forEach(([estado, total]) => {
      const contador = document.querySelector(`[data-conteo-negocios="${estado}"]`);
      if (contador) contador.textContent = String(total);
    });
    tabs.forEach((tab) => {
      tab.setAttribute('aria-pressed', String(tab.dataset.tabNegocios === tabActivo));
    });

    const consulta = normalizarBusqueda(busquedaNegocios?.value);
    const visibles = negociosDelTab().filter((negocio) =>
      normalizarBusqueda(negocio.nombre).includes(consulta)
    );
    if (visibles.length === 0) {
      const texto = consulta
        ? 'No hay negocios que coincidan con la búsqueda en este filtro.'
        : tabActivo === 'PENDIENTE'
          ? 'No hay negocios pendientes.'
          : 'No hay negocios para mostrar en este filtro.';
      tbody.innerHTML = `<tr><td colspan="6" class="tabla__vacio">${texto}</td></tr>`;
      return;
    }

    tbody.innerHTML = visibles.map((negocio) => {
      const nombreEntidad = negocio.organizador?.nombreEntidad || '—';
      const ciudad = negocio.ciudad?.nombre || negocio.ciudad?.nombreCiudad || '—';
      return `
        <tr data-id="${escapar(negocio.id)}">
          <td class="celda-titulo">
            ${escapar(negocio.nombre || '—')}
            <span class="celda-subtitulo">${negocio.destacado ? 'Destacado · ' : ''}${escapar(negocio.direccion || 'Sin dirección')}</span>
          </td>
          <td class="celda-secundaria">${escapar(nombreEntidad)}</td>
          <td>${escapar(negocio.categoria || '—')}<span class="celda-subtitulo">${escapar(ciudad)}</span></td>
          <td class="celda-secundaria">${fecha(negocio.creadoEn)}</td>
          <td>${etiquetaEstado(negocio.estadoPublicacion)}</td>
          <td class="columna-acciones">${botonesDeAccion(negocio)}</td>
        </tr>`;
    }).join('');
  };

  const cargarNegocios = async () => {
    tbody.innerHTML = '<tr><td colspan="6" class="tabla__cargando">Cargando negocios…</td></tr>';
    try {
      negocios = extraerNegocios(await AC_API.listarNegociosAdminTodos());
      renderizar();
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="6" class="tabla__error">No se pudieron cargar los negocios: ${escapar(error.message)} <button type="button" class="boton boton-sm boton-secundario" data-reintentar-negocios>Reintentar</button></td></tr>`;
    }
  };

  const cerrar = (modal) => {
    if (modal) modal.hidden = true;
  };

  const abrirDetalle = (negocio) => {
    if (!modalDetalle || !contenidoDetalle) return;
    const imagen = urlSegura(negocio.imagenPrincipalUrl);
    const urlImagenHtml = imagen
      ? `<img class="modal-eventos__imagen" src="${escapar(imagen)}" alt="${escapar(negocio.nombre || 'Imagen del negocio')}">`
      : '<div class="modal-eventos__imagen" aria-label="Sin imagen disponible"></div>';
    contenidoDetalle.innerHTML = `
      <div class="modal-eventos__detalle">
        <div>
          ${urlImagenHtml}
          <p class="modal-eventos__categoria">${escapar(negocio.categoria || '—')}</p>
          <h3 class="modal-eventos__titulo">${escapar(negocio.nombre || '—')}</h3>
        </div>
        <div>
          <dl class="modal-eventos__datos">
            <dt>Descripción</dt><dd class="modal-eventos__descripcion">${escapar(negocio.descripcion || '—')}</dd>
            <dt>Organizador</dt><dd>${escapar(negocio.organizador?.nombreEntidad || '—')}</dd>
            <dt>Ciudad</dt><dd>${escapar(negocio.ciudad?.nombre || negocio.ciudad?.nombreCiudad || '—')}</dd>
            <dt>Dirección</dt><dd>${escapar(negocio.direccion || '—')}</dd>
            <dt>Teléfono</dt><dd>${escapar(negocio.telefono || '—')}</dd>
            <dt>WhatsApp</dt><dd>${escapar(negocio.whatsapp || '—')}</dd>
            <dt>Instagram</dt><dd>${escapar(negocio.instagram || '—')}</dd>
            <dt>Precio promedio</dt><dd>${negocio.precioPromedio == null ? '—' : `$${Number(negocio.precioPromedio).toLocaleString('es-CO')}`}</dd>
            <dt>Estado</dt><dd>${etiquetaEstado(negocio.estadoPublicacion)}</dd>
            <dt>Motivo de rechazo</dt><dd>${escapar(negocio.motivoRechazo || '—')}</dd>
          </dl>
        </div>
      </div>`;
    modalDetalle.hidden = false;
  };

  const abrirModalMotivo = (negocio, accion) => {
    if (!modalMotivo || !selectMotivo) return;
    negocioSeleccionado = negocio;
    accionMotivo = accion;
    selectMotivo.value = '';
    if (textareaMotivo) textareaMotivo.value = '';
    if (detalleMotivo) detalleMotivo.hidden = true;
    if (tituloMotivo) tituloMotivo.textContent = accion === 'eliminar' ? 'Eliminar negocio' : 'Rechazar negocio';
    if (confirmacionMotivo) {
      confirmacionMotivo.hidden = accion !== 'eliminar';
      confirmacionMotivo.textContent = accion === 'eliminar'
        ? `¿Eliminar "${negocio.nombre}"? El organizador será notificado con el motivo indicado.`
        : '';
    }
    const aviso = modalMotivo.querySelector('[data-aviso-motivo-negocio]');
    if (aviso) aviso.hidden = accion !== 'eliminar';
    if (botonConfirmar) {
      botonConfirmar.textContent = accion === 'eliminar' ? 'Eliminar' : 'Rechazar';
      botonConfirmar.disabled = false;
    }
    modalMotivo.hidden = false;
  };

  const obtenerMotivo = () => {
    if (!selectMotivo?.value) {
      alert('Selecciona un motivo para continuar.');
      selectMotivo?.focus();
      return null;
    }
    if (selectMotivo.value === 'OTRO') {
      const detalle = textareaMotivo?.value.trim() || '';
      if (detalle.length < 5) {
        alert('Especifica el motivo con al menos 5 caracteres.');
        textareaMotivo?.focus();
        return null;
      }
      return detalle;
    }
    return selectMotivo.value;
  };

  const ejecutarAccion = async (boton) => {
    const negocio = negocios.find((item) => String(item.id) === boton.dataset.id);
    if (!negocio) return;
    const accion = boton.dataset.accionNegocio;
    if (accion === 'detalle') {
      abrirDetalle(negocio);
      return;
    }
    if (accion === 'rechazar' || accion === 'eliminar') {
      abrirModalMotivo(negocio, accion);
      return;
    }

    boton.disabled = true;
    try {
      if (accion === 'aprobar') {
        await AC_API.aprobarNegocio(negocio.id);
      } else if (accion === 'destacar') {
        await AC_API.destacarNegocio(negocio.id, boton.dataset.destacado === 'true');
      }
      await cargarNegocios();
    } catch (error) {
      alert(`No se pudo completar la acción: ${error.message}`);
      boton.disabled = false;
    }
  };

  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabActivo = tab.dataset.tabNegocios;
    renderizar();
  }));

  busquedaNegocios?.addEventListener('input', () => {
    clearTimeout(temporizadorBusquedaNegocios);
    temporizadorBusquedaNegocios = setTimeout(renderizar, 150);
  });

  tbody.addEventListener('click', (evento) => {
    const reintentar = evento.target.closest('[data-reintentar-negocios]');
    if (reintentar) {
      cargarNegocios();
      return;
    }
    const boton = evento.target.closest('[data-accion-negocio][data-id]');
    if (boton) ejecutarAccion(boton);
  });

  selectMotivo?.addEventListener('change', () => {
    if (detalleMotivo) detalleMotivo.hidden = selectMotivo.value !== 'OTRO';
  });

  botonConfirmar?.addEventListener('click', async () => {
    if (!negocioSeleccionado || !accionMotivo) return;
    const motivo = obtenerMotivo();
    if (!motivo) return;
    botonConfirmar.disabled = true;
    try {
      if (accionMotivo === 'eliminar') {
        await AC_API.eliminarNegocio(negocioSeleccionado.id, motivo);
      } else {
        await AC_API.rechazarNegocio(negocioSeleccionado.id, motivo);
      }
      cerrar(modalMotivo);
      negocioSeleccionado = null;
      accionMotivo = null;
      await cargarNegocios();
    } catch (error) {
      alert(`No se pudo completar la acción: ${error.message}`);
    } finally {
      botonConfirmar.disabled = false;
    }
  });

  document.querySelectorAll('[data-cerrar-modal-negocio]').forEach((boton) => {
    boton.addEventListener('click', () => cerrar(modalDetalle));
  });
  document.querySelectorAll('[data-cerrar-motivo-negocio]').forEach((boton) => {
    boton.addEventListener('click', () => cerrar(modalMotivo));
  });
  [modalDetalle, modalMotivo].forEach((modal) => {
    modal?.addEventListener('click', (evento) => {
      if (evento.target === modal) cerrar(modal);
    });
  });
  menu?.addEventListener('click', () => {
    if (sidebar) sidebar.classList.toggle('abierto');
    menu.setAttribute('aria-expanded', String(sidebar?.classList.contains('abierto') || false));
  });

  cargarNegocios();
})();
