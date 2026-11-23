/**
 * Panel de pendientes administrativos conectado a los listados de moderación existentes.
 */
(function () {
  const boton = document.querySelector('[data-admin-notificaciones]');
  const acciones = boton?.closest('.panel-header__acciones');
  const api = typeof AC_API === 'undefined' ? null : AC_API;
  if (!boton || !acciones || !api || !api.getToken()) return;

  const panel = document.createElement('section');
  panel.className = 'admin-notificaciones';
  panel.id = boton.getAttribute('aria-controls') || 'admin-notificaciones-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Pendientes administrativos');
  panel.innerHTML = `
    <header class="admin-notificaciones__header">
      <div>
        <h2>Pendientes por revisar</h2>
        <p>Solicitudes que requieren atención administrativa.</p>
      </div>
      <button type="button" class="admin-notificaciones__cerrar" aria-label="Cerrar notificaciones">×</button>
    </header>
    <p class="admin-notificaciones__estado" data-admin-notificaciones-estado aria-live="polite">Cargando pendientes…</p>
    <button type="button" class="admin-notificaciones__reintentar" data-admin-notificaciones-retry hidden>Volver a intentar</button>
    <ul class="admin-notificaciones__lista">
      <li data-tipo-pendiente="eventos">
        <span class="admin-notificaciones__icono" aria-hidden="true">▣</span>
        <span class="admin-notificaciones__contenido"><strong>Eventos</strong><small data-detalle-pendiente>Esperando consulta…</small></span>
        <strong class="admin-notificaciones__cantidad" data-cantidad-pendiente>—</strong>
        <a href="eventos.html" aria-label="Revisar eventos pendientes">Revisar</a>
      </li>
      <li data-tipo-pendiente="negocios">
        <span class="admin-notificaciones__icono" aria-hidden="true">◇</span>
        <span class="admin-notificaciones__contenido"><strong>Negocios</strong><small data-detalle-pendiente>Esperando consulta…</small></span>
        <strong class="admin-notificaciones__cantidad" data-cantidad-pendiente>—</strong>
        <a href="negocios.html" aria-label="Revisar negocios pendientes">Revisar</a>
      </li>
      <li data-tipo-pendiente="organizadores">
        <span class="admin-notificaciones__icono" aria-hidden="true">◎</span>
        <span class="admin-notificaciones__contenido"><strong>Organizadores</strong><small data-detalle-pendiente>Esperando consulta…</small></span>
        <strong class="admin-notificaciones__cantidad" data-cantidad-pendiente>—</strong>
        <a href="organizadores.html" aria-label="Revisar organizadores pendientes">Revisar</a>
      </li>
    </ul>`;

  acciones.append(panel);

  const indicador = boton.querySelector('.punto-notificacion');
  const estado = panel.querySelector('[data-admin-notificaciones-estado]');
  const cerrar = panel.querySelector('.admin-notificaciones__cerrar');
  const reintentar = panel.querySelector('[data-admin-notificaciones-retry]');
  const elementos = [...panel.querySelectorAll('[data-tipo-pendiente]')];
  let ultimaActualizacion = 0;
  let cargando = false;

  const establecerAbierto = (abierto) => {
    panel.hidden = !abierto;
    boton.setAttribute('aria-expanded', String(abierto));
  };

  const consultar = async () => {
    if (cargando) return;
    cargando = true;
    estado.textContent = 'Consultando pendientes…';
    reintentar.hidden = true;
    elementos.forEach((elemento) => {
      elemento.querySelector('[data-cantidad-pendiente]').textContent = '…';
      elemento.querySelector('[data-detalle-pendiente]').textContent = 'Consultando…';
    });

    const consultas = [
      { clave: 'eventos', metodo: api.listarEventosPendientes },
      { clave: 'negocios', metodo: api.listarNegociosPendientes },
      { clave: 'organizadores', metodo: api.listarOrganizadoresPendientes },
    ];
    const resultados = await Promise.allSettled(
      consultas.map(({ metodo }) => Promise.resolve().then(() => {
        if (typeof metodo !== 'function') throw new Error('Conexión de pendientes no disponible.');
        return metodo();
      }))
    );

    let total = 0;
    let fallos = 0;
    resultados.forEach((resultado, indice) => {
      const elemento = elementos.find((item) => item.dataset.tipoPendiente === consultas[indice].clave);
      if (resultado.status === 'fulfilled' && Array.isArray(resultado.value)) {
        const cantidad = resultado.value.length;
        elemento.querySelector('[data-cantidad-pendiente]').textContent = String(cantidad);
        elemento.querySelector('[data-detalle-pendiente]').textContent =
          cantidad === 1 ? '1 solicitud pendiente' : `${cantidad} solicitudes pendientes`;
        total += cantidad;
      } else {
        elemento.querySelector('[data-cantidad-pendiente]').textContent = '—';
        elemento.querySelector('[data-detalle-pendiente]').textContent = 'No se pudo consultar';
        fallos += 1;
      }
    });

    if (fallos) {
      estado.textContent = `No se pudieron consultar ${fallos} de ${consultas.length} secciones. Intenta de nuevo.`;
      reintentar.hidden = false;
      indicador.hidden = false;
      boton.setAttribute('aria-label', 'Notificaciones: no se pudo verificar todo');
    } else {
      estado.textContent = total
        ? `${total} ${total === 1 ? 'solicitud requiere' : 'solicitudes requieren'} revisión.`
        : 'No hay pendientes de moderación.';
      indicador.hidden = total === 0;
      boton.setAttribute(
        'aria-label',
        total ? `Notificaciones: ${total} solicitudes pendientes` : 'Notificaciones: sin pendientes'
      );
    }

    ultimaActualizacion = Date.now();
    cargando = false;
  };

  boton.addEventListener('click', () => {
    const abierto = boton.getAttribute('aria-expanded') === 'true';
    establecerAbierto(!abierto);
    if (!abierto) void consultar();
  });

  cerrar.addEventListener('click', () => establecerAbierto(false));
  reintentar.addEventListener('click', () => void consultar());
  document.addEventListener('click', (evento) => {
    if (!panel.hidden && !panel.contains(evento.target) && !boton.contains(evento.target)) {
      establecerAbierto(false);
    }
  });
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && !panel.hidden) {
      establecerAbierto(false);
      boton.focus();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - ultimaActualizacion > 30_000) void consultar();
  });

  indicador.hidden = true;
  boton.setAttribute('aria-expanded', 'false');
  void consultar();
})();
