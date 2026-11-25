/**
 * Agenda Caucana — Home.
 * Carga categorías (para las píldoras de filtro) y eventos desde la API real.
 * Las publicaciones se obtienen del backend; no se muestran datos de ejemplo
 * cuando la API no está disponible.
 */
(function () {
  const traducir = (_clave, respaldo) => respaldo;
  const formatoPrecio = (valor) => new Intl.NumberFormat(
    { es: 'es-CO', en: 'en-US', fr: 'fr-FR' }[AC_API.getLocale()] || 'es-CO',
    { style: 'currency', currency: 'COP', maximumFractionDigits: 0 },
  ).format(Number(valor));
  const categoriasNegocio = {
    TRADICIONAL_CAUCANA: 'tradicional',
    COMIDA_RAPIDA: 'rapida',
    PARRILLA: 'parrilla',
    PIZZA: 'pizza',
    SUSHI: 'sushi',
    POSTRES: 'postres',
    CAFETERIA: 'cafe',
    BEBIDAS: 'bebidas',
    VEGETARIANA: 'vegetariana',
    OTRO: 'otro',
  };
  const etiquetaCategoriaNegocio = (categoria) => {
    const valor = String(categoria || '');
    const clave = categoriasNegocio[valor.toUpperCase()];
    return clave
      ? traducir(`saboresPagina.categorias.${clave}`, valor.replaceAll('_', ' '))
      : valor.replaceAll('_', ' ');
  };
  const grid = document.querySelector('[data-grid-eventos]');
  const contenedorPildoras = document.querySelector('[data-pildoras]');
  const contadorResultados = document.querySelector('[data-contador-resultados]');
  const formBusqueda = document.querySelector('[data-form-busqueda]');
  const inputBusqueda = document.querySelector('[data-input-busqueda]');
  const filtroDesde = document.querySelector('[data-evento-desde]');
  const filtroHasta = document.querySelector('[data-evento-hasta]');
  const modoPrecio = document.querySelector('[data-evento-precio-modo]');
  const precioExacto = document.querySelector('[data-evento-precio-exacto]');
  const contenedorPrecioExacto = document.querySelector('[data-evento-precio-exacto-contenedor]');
  const precioMinimo = document.querySelector('[data-evento-precio-min]');
  const precioMaximo = document.querySelector('[data-evento-precio-max]');
  const contenedorRangoPrecio = document.querySelector('[data-evento-precio-rango]');
  const errorPrecio = document.querySelector('[data-error-precio-eventos]');
  const filtroOrden = document.querySelector('[data-evento-orden]');
  const limpiarFiltros = document.querySelector('[data-limpiar-filtros-eventos]');
  const errorFiltros = document.querySelector('[data-error-filtros]');
  const resumenFiltros = document.querySelector('[data-resumen-filtros]');

  function crearTarjetaNegocio(negocio) {
    const tarjeta = document.createElement('a');
    tarjeta.className = 'tarjeta-negocio';
    tarjeta.href = `negocio.html?slug=${encodeURIComponent(negocio.slug || '')}`;

    const imagen = document.createElement('div');
    imagen.className = 'tarjeta-negocio__imagen';
    if (negocio.imagenPrincipalUrl) {
      const img = document.createElement('img');
      img.src = negocio.imagenPrincipalUrl;
      img.alt = negocio.nombre || 'Negocio';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        imagen.replaceChildren();
        imagen.classList.add('tarjeta-negocio__imagen--vacio');
        imagen.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
      }, { once: true });
      imagen.appendChild(img);
    } else {
      imagen.classList.add('tarjeta-negocio__imagen--vacio');
      imagen.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
    }

    const categoria = document.createElement('span');
    categoria.className = 'tarjeta-negocio__categoria';
    categoria.textContent = etiquetaCategoriaNegocio(negocio.categoria);
    imagen.appendChild(categoria);
    if (negocio.destacado) {
      const destacado = document.createElement('span');
      destacado.className = 'tarjeta-negocio__destacado';
      destacado.textContent = traducir('home.destacado', 'Destacado');
      imagen.appendChild(destacado);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'tarjeta-negocio__cuerpo';
    const titulo = document.createElement('h3');
    titulo.className = 'tarjeta-negocio__titulo';
    titulo.textContent = negocio.nombre || 'Negocio';
    const direccion = document.createElement('p');
    direccion.className = 'tarjeta-negocio__direccion';
    direccion.textContent = negocio.direccion || '';
    const rating = document.createElement('div');
    rating.className = 'tarjeta-negocio__rating';
    const estrellas = document.createElement('span');
    estrellas.className = 'estrellas';
    const promedio = Number(negocio.promedioEstrellas) || 0;
    estrellas.textContent = `${'★'.repeat(Math.round(promedio))}${'☆'.repeat(5 - Math.round(promedio))}`;
    const numero = document.createElement('span');
    numero.className = 'rating-numero';
    numero.textContent = promedio ? promedio.toFixed(1) : '—';
    const total = document.createElement('span');
    total.className = 'rating-total';
    total.textContent = `(${Number(negocio.totalCalificaciones) || 0})`;
    rating.append(estrellas, numero, total);
    cuerpo.append(titulo, direccion, rating);

    const precio = document.createElement('p');
    precio.className = 'tarjeta-negocio__precio';
    precio.textContent = negocio.precioPromedio == null
      ? traducir('home.precioNoDisponible', 'Precio no disponible')
      : `${formatoPrecio(negocio.precioPromedio)} ${traducir('home.promedio', 'promedio')}`;
    cuerpo.appendChild(precio);
    tarjeta.append(imagen, cuerpo);
    return tarjeta;
  }

  async function cargarNegociosDestacados() {
    if (!gridNegociosDestacados) return;
    try {
      const respuesta = await AC_API.listarNegocios({ orden: 'mejor-calificados', limite: 4 });
      const negocios = respuesta.negocios || respuesta.data || [];
      if (!Array.isArray(negocios) || negocios.length === 0) {
        gridNegociosDestacados.textContent = traducir('home.proximamenteNegocios', 'Pronto encontrarás aquí lugares para disfrutar la cocina caucana.');
        return;
      }
      gridNegociosDestacados.replaceChildren(...negocios.slice(0, 4).map(crearTarjetaNegocio));
    } catch (error) {
      console.error('No se pudieron cargar los negocios destacados:', error);
      gridNegociosDestacados.textContent = traducir('home.errorNegocios', 'No fue posible cargar los negocios en este momento.');
    }
  }

  const gridNegociosDestacados = document.querySelector('[data-negocios-destacados]');
  if (gridNegociosDestacados) cargarNegociosDestacados();
  if (!grid) return;

  let categoriaActiva = null;
  let terminoBusqueda = '';
  let ultimaSolicitudEventos = 0;
  let temporizadorBusqueda;

  function sincronizarLimitesFechas() {
    if (filtroHasta) filtroHasta.min = filtroDesde?.value || '';
    if (filtroDesde) filtroDesde.max = filtroHasta?.value || '';
  }

  function validarRangoFechas() {
    const rangoInvalido = Boolean(
      filtroDesde?.value &&
      filtroHasta?.value &&
      filtroDesde.value > filtroHasta.value,
    );
    if (errorFiltros) {
      errorFiltros.hidden = !rangoInvalido;
      errorFiltros.textContent = rangoInvalido
        ? 'La fecha “Desde” debe ser anterior o igual a la fecha “Hasta”.'
        : '';
    }
    [filtroDesde, filtroHasta].forEach((filtro) => {
      if (!filtro) return;
      if (rangoInvalido) filtro.setAttribute('aria-invalid', 'true');
      else filtro.removeAttribute('aria-invalid');
    });
    return !rangoInvalido;
  }

  function leerPrecio(input) {
    if (!input?.value.trim()) return undefined;
    const valor = Number(input.value);
    return Number.isFinite(valor) && valor >= 0 ? valor : null;
  }

  function actualizarControlesPrecio() {
    const modo = modoPrecio?.value || 'todos';
    if (contenedorPrecioExacto) contenedorPrecioExacto.hidden = modo !== 'exacto';
    if (contenedorRangoPrecio) contenedorRangoPrecio.hidden = modo !== 'rango';
    if (modo === 'todos' || modo === 'gratis') {
      if (precioExacto) precioExacto.value = '';
      if (precioMinimo) precioMinimo.value = '';
      if (precioMaximo) precioMaximo.value = '';
    }
  }

  function validarPrecio() {
    const modo = modoPrecio?.value || 'todos';
    const exacto = leerPrecio(precioExacto);
    const minimo = leerPrecio(precioMinimo);
    const maximo = leerPrecio(precioMaximo);
    let mensaje = '';
    if (modo === 'exacto' && (exacto === undefined || exacto === null)) {
      mensaje = exacto === null
        ? 'Ingresa un precio exacto válido en pesos colombianos.'
        : 'Ingresa el precio exacto que buscas.';
    } else if (modo === 'rango' && (minimo === null || maximo === null)) {
      mensaje = 'Ingresa límites de precio válidos en pesos colombianos.';
    } else if (modo === 'rango' && minimo === undefined && maximo === undefined) {
      mensaje = 'Ingresa al menos un límite para el rango de precios.';
    } else if (modo === 'rango' && minimo !== undefined && maximo !== undefined && minimo > maximo) {
      mensaje = 'El precio mínimo no puede superar el precio máximo.';
    }
    if (errorPrecio) {
      errorPrecio.hidden = !mensaje;
      errorPrecio.textContent = mensaje;
    }
    [precioExacto, precioMinimo, precioMaximo].forEach((input) => {
      if (!input) return;
      if (mensaje && !input.closest('[hidden]')) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    });
    return !mensaje;
  }

  function obtenerParametrosPrecio() {
    const modo = modoPrecio?.value || 'todos';
    if (modo === 'gratis') return { precioMin: 0, precioMax: 0 };
    if (modo === 'exacto') {
      const precio = leerPrecio(precioExacto);
      return { precioMin: precio, precioMax: precio };
    }
    if (modo === 'rango') {
      const minimo = leerPrecio(precioMinimo);
      const maximo = leerPrecio(precioMaximo);
      return {
        ...(minimo !== undefined ? { precioMin: minimo } : {}),
        ...(maximo !== undefined ? { precioMax: maximo } : {}),
      };
    }
    return {};
  }

  function fechaLegible(fecha) {
    if (!fecha) return '';
    const locale = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' }[AC_API.getLocale()] || 'es-CO';
    return new Date(`${fecha}T12:00:00`).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function actualizarResumenFiltros() {
    const filtrosActivos = [];
    if (terminoBusqueda) filtrosActivos.push(`Búsqueda: “${terminoBusqueda}”`);
    if (categoriaActiva) {
      const categoria = contenedorPildoras?.querySelector('.pildora[aria-pressed="true"]');
      filtrosActivos.push(`Categoría: ${categoria?.textContent.trim() || categoriaActiva}`);
    }
    if (filtroDesde?.value) filtrosActivos.push(`Desde: ${fechaLegible(filtroDesde.value)}`);
    if (filtroHasta?.value) filtrosActivos.push(`Hasta: ${fechaLegible(filtroHasta.value)}`);
    const modo = modoPrecio?.value || 'todos';
    if (modo === 'gratis') filtrosActivos.push('Precio: Gratis');
    if (modo === 'exacto' && precioExacto?.value) {
      filtrosActivos.push(`Precio exacto: ${formatoPrecio(precioExacto.value)}`);
    }
    if (modo === 'rango' && (precioMinimo?.value || precioMaximo?.value)) {
      filtrosActivos.push(`Precio: ${precioMinimo?.value ? formatoPrecio(precioMinimo.value) : 'sin mínimo'} – ${precioMaximo?.value ? formatoPrecio(precioMaximo.value) : 'sin máximo'}`);
    }
    if (filtroOrden?.value && filtroOrden.value !== 'fecha') {
      filtrosActivos.push(`Orden: ${filtroOrden.selectedOptions[0]?.textContent.trim() || filtroOrden.value}`);
    }
    if (limpiarFiltros) limpiarFiltros.disabled = filtrosActivos.length === 0;
    if (resumenFiltros) {
      resumenFiltros.textContent = filtrosActivos.length
        ? `Filtros activos: ${filtrosActivos.join(' · ')}`
        : 'Mostrando próximos eventos. Puedes combinar los filtros para afinar la búsqueda.';
    }
  }

  function buscarEventosAhora() {
    clearTimeout(temporizadorBusqueda);
    terminoBusqueda = inputBusqueda?.value.trim() || '';
    sincronizarLimitesFechas();
    actualizarResumenFiltros();
    cargarEventos();
  }

  function formatearFecha(iso) {
    try {
      const locale = { es: 'es-CO', en: 'en-US', fr: 'fr-FR' }[AC_API.getLocale()] || 'es-CO';
      return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
    } catch { return iso; }
  }

  function tarjetaHtml(evento) {
    const precio = evento.precioReferencial == null
      ? 0
      : Number(evento.precioReferencial);
    const gratis = precio === 0;
    const etiqueta = gratis
      ? `<span class="etiqueta-flotante etiqueta-gratis">${traducir('home.gratis', 'Gratis')}</span>`
      : `<span class="etiqueta-flotante etiqueta-precio">${formatoPrecio(precio)}</span>`;
    return `
      <a class="tarjeta-evento" href="evento.html?slug=${encodeURIComponent(evento.slug)}">
        <div class="tarjeta-evento__imagen">
          <img src="${evento.imagenUrl || evento.imagen || 'https://images.unsplash.com/photo-1533174000265-e8cb9968ba15?auto=format&fit=crop&q=80&w=600'}" alt="${evento.titulo}" loading="lazy">
          ${etiqueta}
        </div>
        <div class="tarjeta-evento__cuerpo">
          <p class="tarjeta-evento__categoria">${evento.categoria?.nombre || evento.categoria || ''}</p>
          <h3 class="tarjeta-evento__titulo">${evento.titulo}</h3>
          <p class="tarjeta-evento__meta">
            <span>📍 ${evento.lugar?.nombre || evento.lugar || ''}</span>
            <span>🗓️ ${formatearFecha(evento.fecha || evento.fechaInicio)}</span>
          </p>
        </div>
      </a>`;
  }

  async function cargarEventos() {
    const solicitud = ++ultimaSolicitudEventos;
    const fechasValidas = validarRangoFechas();
    const precioValido = validarPrecio();
    if (!fechasValidas || !precioValido) {
      grid.setAttribute('aria-busy', 'false');
      if (contadorResultados) contadorResultados.textContent = 'Revisa los filtros de fecha y precio.';
      return;
    }
    grid.setAttribute('aria-busy', 'true');
    if (contadorResultados) contadorResultados.textContent = 'Buscando eventos...';
    try {
      const params = {};
      params.orden = filtroOrden?.value || 'fecha';
      if (categoriaActiva) params.categoriaSlug = categoriaActiva;
      if (terminoBusqueda) params.q = terminoBusqueda;
      if (filtroDesde?.value) params.desde = filtroDesde.value;
      if (filtroHasta?.value) params.hasta = filtroHasta.value;
      Object.assign(params, obtenerParametrosPrecio());
      const respuesta = await AC_API.listarEventos(params);
      if (solicitud !== ultimaSolicitudEventos) return;
      const eventos = respuesta.eventos || respuesta.data || respuesta;
      if (!Array.isArray(eventos) || eventos.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;color:var(--tinta-55);padding:2rem 0;">${traducir('home.sinEventos', 'No encontramos eventos con ese filtro. Prueba con otra categoría o búsqueda.')}</p>`;
        if (contadorResultados) contadorResultados.textContent = traducir('home.ceroEventos', '0 eventos encontrados');
        return;
      }
      grid.innerHTML = eventos.map(tarjetaHtml).join('');
      if (contadorResultados) {
        const clave = eventos.length === 1 ? 'home.unEvento' : 'home.variosEventos';
        const respaldo = eventos.length === 1
          ? '1 evento encontrado'
          : `${eventos.length} eventos encontrados`;
        contadorResultados.textContent = traducir(clave, respaldo)
          .replace('{n}', String(eventos.length));
      }
    } catch (error) {
      if (solicitud !== ultimaSolicitudEventos) return;
      console.error('No se pudieron cargar las publicaciones desde la API:', error);
      grid.innerHTML = `<p style="grid-column:1/-1;color:var(--tinta-55);padding:2rem 0;">${traducir('home.errorCarga', 'No se pudieron cargar las publicaciones. Verifica que el backend esté iniciado e intenta recargar la página.')}</p>`;
      if (contadorResultados) contadorResultados.textContent = traducir('home.errorContador', 'Error al cargar publicaciones');
    } finally {
      if (solicitud === ultimaSolicitudEventos) grid.setAttribute('aria-busy', 'false');
    }
  }

  async function cargarCategorias() {
    if (!contenedorPildoras) return;
    try {
      const respuesta = await AC_API.listarCategorias();
      const categorias = respuesta.categorias || respuesta.data || respuesta;
      if (!Array.isArray(categorias) || categorias.length === 0) {
        activarEscuchaPildoras();
        return;
      }

      const pildoraTodos = `<button class="pildora" type="button" data-categoria="" aria-pressed="${categoriaActiva ? 'false' : 'true'}">${traducir('filtros.todos', 'Todos')}</button>`;
      const resto = categorias.map((cat) => {
        return `<button class="pildora" type="button" data-categoria="${cat.slug}" aria-pressed="${cat.slug === categoriaActiva ? 'true' : 'false'}">${cat.nombre}</button>`;
      }).join('');
      contenedorPildoras.innerHTML = pildoraTodos + resto;
      activarEscuchaPildoras();
    } catch (error) {
      activarEscuchaPildoras();
    }
  }

  function activarEscuchaPildoras() {
    contenedorPildoras.querySelectorAll('.pildora').forEach((boton) => {
      boton.addEventListener('click', () => {
        contenedorPildoras.querySelectorAll('.pildora').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        boton.setAttribute('aria-pressed', 'true');
        categoriaActiva = boton.dataset.categoria || null;
        buscarEventosAhora();
      });
    });
  }

  inputBusqueda?.addEventListener('input', () => {
    terminoBusqueda = inputBusqueda.value.trim();
    actualizarResumenFiltros();
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(cargarEventos, 300);
  });

  if (formBusqueda) {
    formBusqueda.addEventListener('submit', (evento) => {
      evento.preventDefault();
      buscarEventosAhora();
    });
  }

  [filtroDesde, filtroHasta, filtroOrden].forEach((filtro) => {
    filtro?.addEventListener('change', buscarEventosAhora);
  });
  modoPrecio?.addEventListener('change', () => {
    actualizarControlesPrecio();
    buscarEventosAhora();
  });
  [precioExacto, precioMinimo, precioMaximo].forEach((input) => {
    input?.addEventListener('input', () => {
      clearTimeout(temporizadorBusqueda);
      actualizarResumenFiltros();
      temporizadorBusqueda = setTimeout(cargarEventos, 300);
    });
  });
  limpiarFiltros?.addEventListener('click', () => {
    categoriaActiva = null;
    contenedorPildoras?.querySelectorAll('.pildora').forEach((boton) => {
      boton.setAttribute('aria-pressed', boton.dataset.categoria ? 'false' : 'true');
    });
    if (filtroDesde) filtroDesde.value = '';
    if (filtroHasta) filtroHasta.value = '';
    if (modoPrecio) modoPrecio.value = 'todos';
    if (precioExacto) precioExacto.value = '';
    if (precioMinimo) precioMinimo.value = '';
    if (precioMaximo) precioMaximo.value = '';
    actualizarControlesPrecio();
    if (filtroOrden) filtroOrden.value = 'fecha';
    if (inputBusqueda) inputBusqueda.value = '';
    buscarEventosAhora();
  });
  document.addEventListener('ac:locale-cambiado', () => {
    cargarNegociosDestacados();
    cargarCategorias();
    buscarEventosAhora();
  });

  sincronizarLimitesFechas();
  actualizarControlesPrecio();
  actualizarResumenFiltros();
  cargarCategorias();
  cargarEventos();
})();