/**
 * Agenda Caucana — Home.
 * Carga categorías (para las píldoras de filtro) y eventos desde la API real.
 * Si el backend no responde (por ejemplo, corriendo esta página sola sin
 * `npm run dev` en backend/), se muestran los eventos de ejemplo del HTML
 * para que el boceto siga siendo revisable sin backend levantado.
 */
(function () {
  const grid = document.querySelector('[data-grid-eventos]');
  const contenedorPildoras = document.querySelector('[data-pildoras]');
  const contadorResultados = document.querySelector('[data-contador-resultados]');
  const formBusqueda = document.querySelector('[data-form-busqueda]');
  const inputBusqueda = document.querySelector('[data-input-busqueda]');

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
    categoria.textContent = String(negocio.categoria || '').replaceAll('_', ' ');
    imagen.appendChild(categoria);
    if (negocio.destacado) {
      const destacado = document.createElement('span');
      destacado.className = 'tarjeta-negocio__destacado';
      destacado.textContent = 'Destacado';
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
      ? 'Precio no disponible'
      : `$${Number(negocio.precioPromedio).toLocaleString('es-CO')} promedio`;
    cuerpo.appendChild(precio);
    tarjeta.append(imagen, cuerpo);
    return tarjeta;
  }

  async function cargarNegociosDestacados() {
    if (!gridNegociosDestacados) return;
    try {
      const respuesta = await AC_API.listarNegocios({ orden: 'destacados', limite: 4 });
      const negocios = respuesta.negocios || respuesta.data || [];
      if (!Array.isArray(negocios) || negocios.length === 0) {
        gridNegociosDestacados.textContent = 'Pronto encontrarás aquí lugares para disfrutar la cocina caucana.';
        return;
      }
      gridNegociosDestacados.replaceChildren(...negocios.slice(0, 4).map(crearTarjetaNegocio));
    } catch (error) {
      console.error('No se pudieron cargar los negocios destacados:', error);
      gridNegociosDestacados.textContent = 'No fue posible cargar los negocios en este momento.';
    }
  }

  const gridNegociosDestacados = document.querySelector('[data-negocios-destacados]');
  if (gridNegociosDestacados) cargarNegociosDestacados();
  if (!grid) return;

  let categoriaActiva = null;
  let terminoBusqueda = '';

  function formatearFecha(iso) {
    try {
      return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit' });
    } catch { return iso; }
  }

  function tarjetaHtml(evento) {
    const precio = evento.precioReferencial == null
      ? 0
      : Number(evento.precioReferencial);
    const gratis = precio === 0;
    const etiqueta = gratis
      ? '<span class="etiqueta-flotante etiqueta-gratis">Gratis</span>'
      : `<span class="etiqueta-flotante etiqueta-precio">$${precio.toLocaleString('es-CO')}</span>`;
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
    try {
      const params = {};
      if (categoriaActiva) params.categoriaSlug = categoriaActiva;
      if (terminoBusqueda) params.q = terminoBusqueda;
      const respuesta = await AC_API.listarEventos(params);
      const eventos = respuesta.eventos || respuesta.data || respuesta;
      if (!Array.isArray(eventos) || eventos.length === 0) {
        grid.innerHTML = '<p style="grid-column:1/-1;color:var(--tinta-55);padding:2rem 0;">No encontramos eventos con ese filtro. Prueba con otra categoría o búsqueda.</p>';
        if (contadorResultados) contadorResultados.textContent = '0 eventos encontrados';
        return;
      }
      grid.innerHTML = eventos.map(tarjetaHtml).join('');
      if (contadorResultados) contadorResultados.textContent = `${eventos.length} eventos destacados encontrados`;
    } catch (error) {
      console.warn('No se pudieron cargar eventos desde la API, se muestran los de ejemplo:', error.message);
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

      const pildoraTodos = '<button class="pildora" type="button" data-categoria="" aria-pressed="true" data-i18n="filtros.todos">Todos</button>';
      const resto = categorias.map((cat) => `<button class="pildora" type="button" data-categoria="${cat.slug}" aria-pressed="false">${cat.nombre}</button>`).join('');
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
        cargarEventos();
      });
    });
  }

  if (formBusqueda) {
    formBusqueda.addEventListener('submit', (evento) => {
      evento.preventDefault();
      terminoBusqueda = inputBusqueda.value.trim();
      cargarEventos();
    });
  }

  cargarCategorias();
  cargarEventos();
})();