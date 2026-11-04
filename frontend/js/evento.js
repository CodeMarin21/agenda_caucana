/**
 * Agenda Caucana — Detalle de evento.
 * Lee ?slug=... de la URL y consulta GET /api/eventos/:slug.
 */
(function () {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  const select = (selector) => document.querySelector(selector);
  const setText = (selector, value, fallback = '—') => {
    const elemento = select(selector);
    if (elemento) elemento.textContent = value == null || value === '' ? fallback : String(value);
  };

  const contenedorRelacionados = select('[data-relacionados]');
  const seccionRelacionados = select('[data-relacionados-seccion]');
  if (contenedorRelacionados) contenedorRelacionados.replaceChildren();

  if (!slug) {
    setText('[data-evento-titulo]', 'Evento no especificado');
    return;
  }

  function formatearFecha(fecha) {
    if (!fecha) return '—';
    const fechaEvento = new Date(fecha);
    if (Number.isNaN(fechaEvento.getTime())) return '—';
    return fechaEvento.toLocaleDateString('es-CO', {
      weekday: 'short',
      day: '2-digit',
      month: 'long',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Bogota',
    });
  }

  function formatearPrecio(precio) {
    if (precio == null || precio === '') return 'Entrada libre';
    const valor = Number(precio);
    if (!Number.isFinite(valor)) return '—';
    if (valor === 0) return 'Entrada libre';
    return `Desde $${valor.toLocaleString('es-CO')} COP`;
  }

  function renderizarRelacionados(eventos, eventoActual) {
    if (!contenedorRelacionados) return;

    const relacionados = (Array.isArray(eventos) ? eventos : [])
      .filter((evento) =>
        evento.slug !== eventoActual.slug &&
        evento.categoria?.slug === eventoActual.categoria?.slug
      )
      .slice(0, 3);

    const tarjetas = relacionados.map((relacionado) => {
      const enlace = document.createElement('a');
      enlace.className = 'tarjeta-evento';
      enlace.href = `evento.html?slug=${encodeURIComponent(relacionado.slug || '')}`;

      const contenedorImagen = document.createElement('div');
      contenedorImagen.className = 'tarjeta-evento__imagen';
      if (relacionado.imagenUrl) {
        const imagen = document.createElement('img');
        imagen.src = relacionado.imagenUrl;
        imagen.alt = relacionado.titulo || 'Evento relacionado';
        imagen.loading = 'lazy';
        contenedorImagen.appendChild(imagen);
      }

      const cuerpo = document.createElement('div');
      cuerpo.className = 'tarjeta-evento__cuerpo';

      const categoria = document.createElement('p');
      categoria.className = 'tarjeta-evento__categoria';
      categoria.textContent = relacionado.categoria?.nombre || '—';

      const titulo = document.createElement('h3');
      titulo.className = 'tarjeta-evento__titulo';
      titulo.textContent = relacionado.titulo || '—';

      cuerpo.append(categoria, titulo);
      enlace.append(contenedorImagen, cuerpo);
      return enlace;
    });

    contenedorRelacionados.replaceChildren(...tarjetas);
    if (seccionRelacionados) seccionRelacionados.hidden = tarjetas.length === 0;
  }

  async function cargarRelacionados(evento) {
    if (!contenedorRelacionados || !evento.categoria?.slug) return;
    try {
      const respuesta = await AC_API.listarEventos({
        categoriaSlug: evento.categoria.slug,
        limite: 4,
      });
      const eventos = Array.isArray(respuesta?.eventos)
        ? respuesta.eventos
        : Array.isArray(respuesta?.data)
          ? respuesta.data
          : respuesta;
      renderizarRelacionados(eventos, evento);
    } catch (error) {
      console.error('No se pudieron cargar eventos relacionados:', error);
    }
  }

  async function cargar() {
    try {
      const evento = await AC_API.obtenerEvento(slug);
      const lugar = evento.lugar || {};
      const nombreLugar = lugar.nombre || '—';
      const fecha = formatearFecha(evento.fechaInicio);
      const precio = formatearPrecio(evento.precioReferencial);
      const categoria = evento.categoria?.nombre || '—';
      const publico = evento.esMayorDeEdad === true
        ? '+18 años'
        : evento.esMayorDeEdad === false
          ? 'Todas las edades'
          : '—';

      document.title = `${evento.titulo || 'Evento'} — Agenda Caucana`;
      setText('[data-evento-titulo]', evento.titulo);
      setText('[data-evento-subtitulo]', evento.subtitulo, '');
      setText('[data-evento-categoria]', categoria);
      setText('[data-migas-categoria]', categoria);
      setText('[data-migas-titulo]', evento.titulo);
      setText('[data-evento-fecha]', fecha);
      setText('[data-evento-fecha-lateral]', fecha);
      setText('[data-evento-descripcion]', evento.descripcion);
      setText('[data-evento-lugar]', nombreLugar);
      setText('[data-evento-lugar-corto]', nombreLugar);
      setText('[data-evento-organiza]', evento.organizador?.nombreEntidad);
      setText('[data-evento-categoria-ficha]', categoria);
      setText('[data-evento-publico]', publico);
      setText('[data-evento-precio]', precio);
      setText('[data-evento-precio-detalle]', precio);

      const direccion = String(evento.direccion || lugar.direccion || '')
        .replace(/\s+/g, ' ')
        .trim();
      const ciudad = evento.ciudad?.nombre || 'Popayán';

      const duracionEl = select('[data-evento-duracion]');
      if (duracionEl) {
        if (evento.fechaInicio && evento.fechaFin) {
          const milisegundos = new Date(evento.fechaFin).getTime() -
            new Date(evento.fechaInicio).getTime();
          if (Number.isFinite(milisegundos) && milisegundos >= 0) {
            const horas = Math.round(milisegundos / 3600000);
            duracionEl.textContent = `Duración aprox. ${horas} hora${horas === 1 ? '' : 's'}`;
          } else {
            duracionEl.textContent = '—';
          }
        } else {
          duracionEl.textContent = '—';
        }
      }

      const imagen = select('[data-evento-imagen]');
      if (imagen) {
        if (evento.imagenUrl) {
          const urlOptimizada = String(evento.imagenUrl).replace(
            '/upload/',
            '/upload/w_1200,c_limit,q_auto,f_auto/'
          );
          imagen.src = urlOptimizada;
          imagen.alt = evento.titulo || 'Imagen del evento';
          imagen.hidden = false;
        } else {
          imagen.removeAttribute('src');
          imagen.hidden = true;
        }
      }

      const enlaceExterno = select('[data-evento-enlace-externo]');
      if (enlaceExterno) {
        const tieneCoords = lugar.latitud != null && lugar.longitud != null;
        const destino = tieneCoords
          ? `${lugar.latitud},${lugar.longitud}`
          : [direccion, lugar.nombre, ciudad, 'Cauca', 'Colombia'].filter(Boolean).join(', ');
        enlaceExterno.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
        enlaceExterno.target = '_blank';
        enlaceExterno.rel = 'noopener noreferrer';
      }

      await cargarRelacionados(evento);
    } catch (error) {
      console.error('No se pudo cargar el evento desde la API:', error);
    }
  }

  cargar();
})();
