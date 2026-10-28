/**
 * Popayán GO — Rutas + mapa.
 * Sigue las notas de UI del contrato: Leaflet + OpenStreetMap, centro en
 * Popayán [2.44191, -76.60643] zoom 15, pines verdes (visitado) / grises
 * (pendiente), click en pin -> modal -> "Registrar Visita" -> geolocalización
 * -> POST /gamificacion/visitas -> modal de éxito.
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('login.html')) return;

  const COLORES = { azul: '#3b82f6', naranja: '#f97316', morado: '#a855f7', rojo: '#ef4444' };

  const contenedorRutas = document.querySelector('[data-lista-rutas]');
  const mapaEl = document.getElementById('go-mapa');
  let mapa;

  function tarjetaRutaHtml(ruta) {
    const color = COLORES[ruta.colorTema] || 'var(--color-terracota)';
    return `
      <article class="go-ruta-card">
        <div class="go-ruta-card__header"><h3>${ruta.nombre}</h3><strong style="color:${color};">${ruta.porcentaje}%</strong></div>
        <p class="go-ruta-card__meta">${ruta.descripcion || ''}</p>
        <div class="go-barra"><div class="go-barra__relleno" style="width:${ruta.porcentaje}%; background:${color};"></div></div>
        <div class="go-ruta-card__pie">
          <span>${ruta.puntosVisitados}/${ruta.puntosTotales} puntos</span>
          <span>${ruta.completada ? '✓ Completada' : ''}</span>
        </div>
      </article>`;
  }

  async function cargarRutas() {
    try {
      const data = await AC_API.listarRutasJugador();
      const rutas = data.rutas || [];
      contenedorRutas.innerHTML = rutas.length
        ? rutas.map(tarjetaRutaHtml).join('')
        : '<p style="color:var(--tinta-55); font-size:0.9rem;">Todavía no hay rutas cargadas.</p>';
      return rutas;
    } catch (error) {
      contenedorRutas.innerHTML = `<p style="color:var(--color-rechazo); font-size:0.85rem;">No se pudieron cargar las rutas: ${error.message}</p>`;
      return [];
    }
  }

  async function cargarMapa(rutas) {
    if (!mapaEl || typeof L === 'undefined') return;
    mapa = L.map(mapaEl).setView([2.44191, -76.60643], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapa);

    for (const ruta of rutas) {
      try {
        const detalle = await AC_API.obtenerRutaJugador(ruta.id);
        (detalle.puntos || []).forEach((punto) => {
          if (!punto.latitud || !punto.longitud) return;
          const icono = L.divIcon({
            className: '',
            html: `<div style="width:1.6rem;height:1.6rem;border-radius:50%;background:${punto.visitado ? '#5F7A6A' : '#8a8378'};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
            iconSize: [26, 26]
          });
          const marcador = L.marker([punto.latitud, punto.longitud], { icon: icono }).addTo(mapa);
          marcador.bindPopup(`
            <strong>${punto.nombre}</strong><br>
            <span style="font-size:0.8rem;">${punto.direccion || ''}</span><br>
            ${punto.visitado ? '<span style="color:#5F7A6A;">✓ Ya visitado</span>' : `<button data-registrar-visita="${punto.lugarId}" style="margin-top:6px;background:#B5502B;color:#fff;border:none;padding:6px 10px;font-size:0.8rem;cursor:pointer;">Registrar visita</button>`}
          `);
        });
      } catch (error) {
        console.warn(`No se pudo cargar el detalle de la ruta ${ruta.id}:`, error.message);
      }
    }

    // Delegación de clicks para los botones "Registrar visita" dentro de los popups
    mapa.on('popupopen', (evento) => {
      const boton = evento.popup._contentNode.querySelector('[data-registrar-visita]');
      if (boton) boton.addEventListener('click', () => iniciarCheckIn(Number(boton.dataset.registrarVisita)));
    });
  }

  function iniciarCheckIn(lugarId) {
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización — no se puede registrar la visita.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        try {
          const resultado = await AC_API.registrarVisita({ lugarId, latitud: latitude, longitud: longitude, accuracy });
          mostrarModalExito(resultado);
        } catch (error) {
          alert(`No se pudo registrar la visita: ${error.message}`);
        }
      },
      (error) => {
        alert('No pudimos obtener tu ubicación. Activa el GPS y da permiso de ubicación al navegador, luego intenta de nuevo.');
        console.error(error);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  function mostrarModalExito(resultado) {
    const overlay = document.querySelector('[data-modal-visita]');
    document.querySelector('[data-modal-visita-texto]').textContent =
      `Has explorado ${resultado.lugarNombre}. ${resultado.esRevisita ? '¡Bienvenido de nuevo!' : '¡Primera vez aquí!'} +${resultado.puntosGanados} pts`;
    const ruta = (resultado.rutasAfectadas || [])[0];
    document.querySelector('[data-modal-visita-chip]').textContent = ruta ? `${ruta.rutaNombre} · ${ruta.porcentaje}%` : `Progreso global: ${resultado.progresoGlobal}%`;
    overlay.hidden = false;
  }

  const cerrarModal = document.querySelector('[data-modal-cerrar-explorar]');
  if (cerrarModal) {
    cerrarModal.addEventListener('click', () => {
      document.querySelector('[data-modal-visita]').hidden = true;
      cargarRutas().then(() => { if (mapa) { mapa.remove(); cargarMapa; } });
      window.location.reload();
    });
  }

  cargarRutas().then((rutas) => cargarMapa(rutas));
})();
