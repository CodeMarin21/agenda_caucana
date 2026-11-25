(function () {
  const grid = document.querySelector('[data-grid-negocios]');
  const contador = document.querySelector('[data-contador-negocios]');
  const formBusqueda = document.querySelector('[data-form-busqueda-sabores]');
  const inputBusqueda = document.querySelector('[data-buscar-negocio]');
  const selectorCiudad = document.querySelector('[data-ciudad-negocio]');
  const listaCategorias = document.querySelector('[data-categorias-negocios]');
  const botonCargarMas = document.querySelector('[data-cargar-mas-negocios]');
  const lugaresDestacados = document.querySelector('[data-lugares-destacados]');
  const modoPrecio = document.querySelector('[data-modo-precio-negocio]');
  const precioExacto = document.querySelector('[data-precio-exacto-negocio]');
  const contenedorPrecioExacto = document.querySelector('[data-precio-exacto-contenedor]');
  const precioMinimo = document.querySelector('[data-precio-min-negocio]');
  const precioMaximo = document.querySelector('[data-precio-max-negocio]');
  const contenedorRangoPrecio = document.querySelector('[data-precio-rango-negocio]');
  const errorPrecio = document.querySelector('[data-error-precio-negocio]');
  if (!grid || !formBusqueda || !inputBusqueda || !selectorCiudad || !listaCategorias) return;

  const texto = (_clave, respaldo) => respaldo;
  const localeActual = () => ({ es: 'es-CO', en: 'en-US', fr: 'fr-FR' }[AC_API.getLocale()] || 'es-CO');
  const CATEGORIAS = [
    { valor: '', etiqueta: 'Todas', clave: 'saboresPagina.todos', icono: 'cat-todas' },
    { valor: 'TRADICIONAL_CAUCANA', etiqueta: 'Tradicional', clave: 'saboresPagina.categorias.tradicional', icono: 'cat-tradicional' },
    { valor: 'COMIDA_RAPIDA', etiqueta: 'Rápida', clave: 'saboresPagina.categorias.rapida', icono: 'cat-rapida' },
    { valor: 'PARRILLA', etiqueta: 'Parrilla', clave: 'saboresPagina.categorias.parrilla', icono: 'cat-parrilla' },
    { valor: 'PIZZA', etiqueta: 'Pizza', clave: 'saboresPagina.categorias.pizza', icono: 'cat-pizza' },
    { valor: 'SUSHI', etiqueta: 'Sushi', clave: 'saboresPagina.categorias.sushi', icono: 'cat-sushi' },
    { valor: 'POSTRES', etiqueta: 'Postres', clave: 'saboresPagina.categorias.postres', icono: 'cat-postres' },
    { valor: 'CAFETERIA', etiqueta: 'Café', clave: 'saboresPagina.categorias.cafe', icono: 'cat-cafeteria' },
    { valor: 'BEBIDAS', etiqueta: 'Bebidas', clave: 'saboresPagina.categorias.bebidas', icono: 'cat-bebidas' },
    { valor: 'VEGETARIANA', etiqueta: 'Veggie', clave: 'saboresPagina.categorias.vegetariana', icono: 'cat-vegetariana' },
    { valor: 'OTRO', etiqueta: 'Otro', clave: 'saboresPagina.categorias.otro', icono: 'cat-otro' },
  ];

  const etiquetaCategoria = (valor) => {
    const item = CATEGORIAS.find((categoria) => categoria.valor === valor);
    return item
      ? texto(item.clave, item.etiqueta)
      : String(valor || texto('saboresPagina.categorias.otro', 'Otro')).replaceAll('_', ' ');
  };
  let categoriaActiva = '';
  let ordenActivo = 'recientes';
  let precioActivo = 'todos';
  let qActivo = '';
  let negocios = [];
  let pagina = 1;
  let totalPaginas = 1;
  let totalServidor = 0;
  let solicitudActual = 0;
  let temporizadorBusqueda;

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-CO');
  }

  function formatearPrecio(precio) {
    if (precio == null || !Number.isFinite(Number(precio))) return texto('saboresPagina.precioNoDisponible', 'Precio no disponible');
    return new Intl.NumberFormat(localeActual(), {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(Number(precio));
  }

  function leerPrecio(input) {
    if (!input?.value.trim()) return undefined;
    const valor = Number(input.value);
    return Number.isInteger(valor) && valor >= 0 ? valor : null;
  }

  function obtenerRangoPrecio() {
    if (precioActivo === 'gratis') return { minimo: 0, maximo: 0 };
    if (precioActivo === 'exacto') {
      const precio = leerPrecio(precioExacto);
      return precio === undefined || precio === null
        ? null
        : { minimo: precio, maximo: precio };
    }
    if (precioActivo === 'rango') {
      return {
        minimo: leerPrecio(precioMinimo),
        maximo: leerPrecio(precioMaximo),
      };
    }
    return null;
  }

  function actualizarControlesPrecio() {
    if (contenedorPrecioExacto) contenedorPrecioExacto.hidden = precioActivo !== 'exacto';
    if (contenedorRangoPrecio) contenedorRangoPrecio.hidden = precioActivo !== 'rango';
    if (precioActivo === 'todos' || precioActivo === 'gratis') {
      if (precioExacto) precioExacto.value = '';
      if (precioMinimo) precioMinimo.value = '';
      if (precioMaximo) precioMaximo.value = '';
    }
  }

  function validarPrecio() {
    const exacto = leerPrecio(precioExacto);
    const minimo = leerPrecio(precioMinimo);
    const maximo = leerPrecio(precioMaximo);
    let mensaje = '';
    if (precioActivo === 'exacto' && (exacto === undefined || exacto === null)) {
      mensaje = exacto === null
        ? texto('saboresPagina.precioInvalido', 'Ingresa un precio exacto válido en pesos colombianos.')
        : texto('saboresPagina.precioExactoRequerido', 'Ingresa el precio exacto que buscas.');
    } else if (precioActivo === 'rango' && (minimo === null || maximo === null)) {
      mensaje = texto('saboresPagina.rangoPrecioInvalido', 'Ingresa límites de precio válidos en pesos colombianos.');
    } else if (precioActivo === 'rango' && minimo === undefined && maximo === undefined) {
      mensaje = texto('saboresPagina.rangoPrecioRequerido', 'Ingresa al menos un límite para el rango de precios.');
    } else if (precioActivo === 'rango' && minimo !== undefined && maximo !== undefined && minimo > maximo) {
      mensaje = texto('saboresPagina.rangoPrecioInvertido', 'El precio mínimo no puede superar el precio máximo.');
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

  function precioDePlatoCoincidente(negocio) {
    const rango = obtenerRangoPrecio();
    if (!rango || !Array.isArray(negocio.platos)) return null;
    return negocio.platos.find((plato) => {
      const precio = Number(plato?.precio);
      if (!Number.isInteger(precio) || precio < 0) return false;
      return (rango.minimo === undefined || precio >= rango.minimo) &&
        (rango.maximo === undefined || precio <= rango.maximo);
    }) || null;
  }

  function crearEstrellas(promedio) {
    const numero = Math.max(0, Math.min(5, Math.round(Number(promedio) || 0)));
    return `${'★'.repeat(numero)}${'☆'.repeat(5 - numero)}`;
  }

  function crearTarjeta(negocio) {
    const tarjeta = document.createElement('a');
    tarjeta.className = 'tarjeta-negocio';
    tarjeta.href = `negocio.html?slug=${encodeURIComponent(negocio.slug || '')}`;

    const imagen = document.createElement('div');
    imagen.className = 'tarjeta-negocio__imagen';
    const etiquetas = [];
    const categoria = document.createElement('span');
    categoria.className = 'tarjeta-negocio__categoria';
    categoria.textContent = etiquetaCategoria(negocio.categoria);
    etiquetas.push(categoria);
    if (negocio.destacado) {
      const destacado = document.createElement('span');
      destacado.className = 'tarjeta-negocio__destacado';
      destacado.textContent = texto('saboresPagina.etiquetaDestacado', 'Destacado');
      etiquetas.push(destacado);
    }

    const mostrarPlaceholder = () => {
      imagen.replaceChildren();
      imagen.classList.add('tarjeta-negocio__imagen--vacio');
      const inicial = document.createElement('span');
      inicial.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
      imagen.appendChild(inicial);
      imagen.append(...etiquetas);
    };
    if (negocio.imagenPrincipalUrl) {
      const img = document.createElement('img');
      img.src = negocio.imagenPrincipalUrl;
      img.alt = negocio.nombre || 'Negocio';
      img.loading = 'lazy';
      img.addEventListener('error', mostrarPlaceholder, { once: true });
      imagen.appendChild(img);
    } else {
      mostrarPlaceholder();
    }
    imagen.append(...etiquetas);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'tarjeta-negocio__cuerpo';
    const titulo = document.createElement('h2');
    titulo.className = 'tarjeta-negocio__titulo';
    titulo.textContent = negocio.nombre || 'Negocio';
    const direccion = document.createElement('p');
    direccion.className = 'tarjeta-negocio__direccion';
    direccion.textContent = negocio.direccion || texto('saboresPagina.direccionNoDisponible', 'Dirección no disponible');
    const rating = document.createElement('div');
    rating.className = 'tarjeta-negocio__rating';
    const estrellas = document.createElement('span');
    estrellas.className = 'estrellas';
    estrellas.setAttribute('aria-label', texto('saboresPagina.ariaCalificacion', '{n} de 5 estrellas')
      .replace('{n}', String(Number(negocio.promedioEstrellas) || 0)));
    estrellas.textContent = crearEstrellas(negocio.promedioEstrellas);
    const numero = document.createElement('span');
    numero.className = 'rating-numero';
    numero.textContent = Number(negocio.promedioEstrellas)
      ? Number(negocio.promedioEstrellas).toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : '—';
    const total = document.createElement('span');
    total.className = 'rating-total';
    total.textContent = `(${Number(negocio.totalCalificaciones) || 0})`;
    rating.append(estrellas, numero, total);
    const precio = document.createElement('p');
    precio.className = 'tarjeta-negocio__precio';
    const platoCoincidente = precioDePlatoCoincidente(negocio);
    precio.textContent = platoCoincidente
      ? texto('saboresPagina.precioPlatoCoincidente', '{plato}: {precio}')
        .replace('{plato}', platoCoincidente.nombre || texto('saboresPagina.plato', 'Plato'))
        .replace('{precio}', formatearPrecio(platoCoincidente.precio))
      : `${formatearPrecio(negocio.precioPromedio)}${negocio.precioPromedio == null ? '' : ` ${texto('saboresPagina.promedio', 'promedio')}`}`;
    cuerpo.append(titulo, direccion, rating, precio);
    tarjeta.append(imagen, cuerpo);
    return tarjeta;
  }

  function crearTarjetaDestacada(negocio) {
    const tarjeta = document.createElement('a');
    tarjeta.className = 'lugar-destacado-sabor';
    tarjeta.href = `negocio.html?slug=${encodeURIComponent(negocio.slug || '')}`;

    const imagen = document.createElement('div');
    imagen.className = 'lugar-destacado-sabor__imagen';
    if (negocio.imagenPrincipalUrl) {
      const img = document.createElement('img');
      img.src = negocio.imagenPrincipalUrl;
      img.alt = `Negocio ${negocio.nombre || 'gastronómico'} en Popayán`;
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        imagen.classList.add('lugar-destacado-sabor__imagen--vacio');
        imagen.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
      }, { once: true });
      imagen.appendChild(img);
    } else {
      imagen.classList.add('lugar-destacado-sabor__imagen--vacio');
      imagen.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'lugar-destacado-sabor__cuerpo';
    const categoria = document.createElement('p');
    categoria.className = 'lugar-destacado-sabor__categoria';
    categoria.textContent = etiquetaCategoria(negocio.categoria);
    const titulo = document.createElement('h3');
    titulo.textContent = negocio.nombre || 'Negocio';
    const direccion = document.createElement('p');
    direccion.className = 'lugar-destacado-sabor__direccion';
    direccion.textContent = negocio.direccion || texto('saboresPagina.direccionNoDisponible', 'Dirección no disponible');
    const resumen = document.createElement('p');
    resumen.className = 'lugar-destacado-sabor__resumen';
    resumen.textContent = negocio.descripcion
      ? String(negocio.descripcion).slice(0, 110)
      : texto('saboresPagina.verMenu', 'Consulta menú, platos y horarios en la ficha del negocio.');

    const pie = document.createElement('p');
    pie.className = 'lugar-destacado-sabor__pie';
    pie.textContent = Number(negocio.promedioEstrellas)
      ? `★ ${Number(negocio.promedioEstrellas).toLocaleString(localeActual(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · ${negocio.precioPromedio != null ? formatearPrecio(negocio.precioPromedio) : texto('saboresPagina.verPrecios', 'Ver precios')}`
      : texto('saboresPagina.verInformacion', 'Ver información del lugar');

    cuerpo.append(categoria, titulo, direccion, resumen, pie);
    tarjeta.append(imagen, cuerpo);
    return tarjeta;
  }

  async function cargarLugaresDestacados() {
    if (!lugaresDestacados) return;
    try {
      const respuesta = await AC_API.listarNegocios({
        pagina: '1',
        limite: '3',
        orden: 'mejor-calificados',
      });
      const recibidos = Array.isArray(respuesta.negocios) ? respuesta.negocios : [];
      lugaresDestacados.replaceChildren();
      if (recibidos.length === 0) {
        const vacio = document.createElement('p');
        vacio.className = 'mensaje-carga-negocios';
        vacio.textContent = texto('saboresPagina.sinDestacados', 'Aún no hay negocios aprobados destacados.');
        lugaresDestacados.appendChild(vacio);
        return;
      }
      lugaresDestacados.append(...recibidos.map(crearTarjetaDestacada));
    } catch (error) {
      console.error('No se pudieron cargar lugares destacados:', error);
      lugaresDestacados.replaceChildren();
      const errorVista = document.createElement('p');
      errorVista.className = 'mensaje-carga-negocios';
      errorVista.textContent = texto('saboresPagina.errorDestacados', 'No fue posible cargar los lugares destacados.');
      lugaresDestacados.appendChild(errorVista);
    }
  }

  function renderizar() {
    const visibles = negocios;
    grid.replaceChildren();
    if (visibles.length === 0) {
      const mensaje = document.createElement('p');
      mensaje.className = 'mensaje-carga-negocios';
      mensaje.textContent = negocios.length > 0
        ? texto('saboresPagina.sinFiltrosCargados', 'No encontramos lugares con esos filtros en los resultados cargados. Puedes cargar más lugares o cambiar la búsqueda.')
        : texto('saboresPagina.sinNegocios', 'No encontramos negocios con esos filtros. Prueba con otra búsqueda o categoría.');
      grid.appendChild(mensaje);
    } else {
      grid.append(...visibles.map(crearTarjeta));
    }
    const unidad = visibles.length === 1
      ? texto('saboresPagina.unLugar', 'lugar mostrado')
      : texto('saboresPagina.variosLugares', 'lugares mostrados');
    const plantilla = totalServidor
      ? texto('saboresPagina.contadorConTotal', '{n} {unidad} de {total}')
      : texto('saboresPagina.contador', '{n} {unidad}');
    contador.textContent = plantilla
      .replace('{n}', String(visibles.length))
      .replace('{unidad}', unidad)
      .replace('{total}', String(totalServidor));
    botonCargarMas.hidden = pagina >= totalPaginas;
  }

  async function cargarNegocios(reiniciar = true) {
    if (!validarPrecio()) {
      solicitudActual += 1;
      grid.setAttribute('aria-busy', 'false');
      botonCargarMas.disabled = false;
      contador.textContent = errorPrecio.textContent;
      return;
    }
    if (reiniciar) {
      pagina = 1;
      totalPaginas = 1;
      totalServidor = 0;
      negocios = [];
    }
    const solicitud = ++solicitudActual;
    grid.setAttribute('aria-busy', 'true');
    botonCargarMas.disabled = true;
    contador.textContent = texto('saboresPagina.cargando', 'Cargando negocios...');
    if (reiniciar) grid.replaceChildren();

    const params = {
      pagina: String(reiniciar ? 1 : pagina + 1),
      limite: '50',
      orden: ordenActivo,
    };
    if (categoriaActiva) params.categoria = categoriaActiva;
    if (selectorCiudad.value) params.ciudadId = selectorCiudad.value;
    const rangoPrecio = obtenerRangoPrecio();
    if (precioActivo === 'gratis') {
      params.precioMin = '0';
      params.precioMax = '0';
    } else if (precioActivo === 'exacto' && rangoPrecio) {
      params.precioMin = String(rangoPrecio.minimo);
      params.precioMax = String(rangoPrecio.maximo);
    } else if (precioActivo === 'rango' && rangoPrecio) {
      if (rangoPrecio.minimo !== undefined) params.precioMin = String(rangoPrecio.minimo);
      if (rangoPrecio.maximo !== undefined) params.precioMax = String(rangoPrecio.maximo);
    }
    if (qActivo) params.q = qActivo;

    try {
      const respuesta = await AC_API.listarNegocios(params);
      if (solicitud !== solicitudActual) return;
      const recibidos = Array.isArray(respuesta.negocios) ? respuesta.negocios : [];
      negocios = reiniciar ? recibidos : negocios.concat(recibidos);
      pagina = Number(respuesta.paginacion?.pagina) || Number(params.pagina);
      totalPaginas = Number(respuesta.paginacion?.totalPaginas) || 1;
      totalServidor = Number(respuesta.paginacion?.total) || 0;
      renderizar();
    } catch (error) {
      if (solicitud !== solicitudActual) return;
      console.error('No se pudieron cargar los negocios:', error);
      grid.replaceChildren();
      const mensaje = document.createElement('p');
      mensaje.className = 'mensaje-carga-negocios';
      mensaje.textContent = texto('saboresPagina.errorCargaMensaje', 'No fue posible cargar los negocios. Intenta nuevamente.');
      grid.appendChild(mensaje);
      contador.textContent = texto('saboresPagina.errorCarga', 'Error al cargar los negocios');
      botonCargarMas.hidden = true;
    } finally {
      if (solicitud === solicitudActual) {
        grid.setAttribute('aria-busy', 'false');
        botonCargarMas.disabled = false;
      }
    }
  }

  async function cargarCiudades() {
    try {
      const respuesta = await AC_API.listarCiudades();
      const ciudades = Array.isArray(respuesta) ? respuesta : respuesta.ciudades || respuesta.data || [];
      if (!Array.isArray(ciudades)) throw new Error('La respuesta de ciudades no tiene el formato esperado');
      ciudades.forEach((ciudad) => {
        const opcion = document.createElement('option');
        opcion.value = String(ciudad.id);
        opcion.textContent = ciudad.nombre;
        selectorCiudad.appendChild(opcion);
      });
      const popayan = ciudades.find((ciudad) => normalizar(ciudad.nombre) === 'popayan');
      if (popayan) selectorCiudad.value = String(popayan.id);
    } catch (error) {
      console.error('No se pudieron cargar las ciudades:', error);
    }
  }

  function crearFiltrosCategoria() {
    listaCategorias.replaceChildren();
    CATEGORIAS.forEach((item, indice) => {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'categoria-circulo';
      boton.dataset.categoria = item.valor;
      boton.setAttribute('aria-pressed', String(item.valor === categoriaActiva));
      const figura = document.createElement('span');
      figura.className = 'categoria-circulo__figura';
      figura.setAttribute('aria-hidden', 'true');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '28');
      svg.setAttribute('height', '28');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', `#${item.icono}`);
      svg.appendChild(use);
      figura.appendChild(svg);
      const etiqueta = document.createElement('span');
      etiqueta.textContent = texto(item.clave, item.etiqueta);
      boton.append(figura, etiqueta);
      boton.addEventListener('click', () => {
        categoriaActiva = item.valor;
        listaCategorias.querySelectorAll('.categoria-circulo').forEach((otro) => {
          otro.setAttribute('aria-pressed', String(otro === boton));
        });
        cargarNegocios();
      });
      listaCategorias.appendChild(boton);
    });
  }

  formBusqueda.addEventListener('submit', (evento) => {
    evento.preventDefault();
    clearTimeout(temporizadorBusqueda);
    qActivo = inputBusqueda.value.trim();
    cargarNegocios(true);
  });
  inputBusqueda.addEventListener('input', () => {
    clearTimeout(temporizadorBusqueda);
    temporizadorBusqueda = setTimeout(() => {
      qActivo = inputBusqueda.value.trim();
      cargarNegocios(true);
    }, 300);
  });
  selectorCiudad.addEventListener('change', () => cargarNegocios());
  document.querySelectorAll('[data-orden]').forEach((boton) => {
    boton.addEventListener('click', () => {
      ordenActivo = boton.dataset.orden;
      document.querySelectorAll('[data-orden]').forEach((otro) => {
        otro.setAttribute('aria-pressed', String(otro === boton));
      });
      cargarNegocios();
    });
  });
  modoPrecio?.addEventListener('change', () => {
    precioActivo = modoPrecio.value;
    actualizarControlesPrecio();
    cargarNegocios();
  });
  [precioExacto, precioMinimo, precioMaximo].forEach((input) => {
    input?.addEventListener('input', () => {
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(() => cargarNegocios(), 300);
    });
  });
  botonCargarMas.addEventListener('click', () => cargarNegocios(false));
  document.addEventListener('ac:locale-cambiado', () => {
    crearFiltrosCategoria();
    actualizarControlesPrecio();
    cargarLugaresDestacados();
    cargarNegocios();
  });

  crearFiltrosCategoria();
  (async () => {
    await cargarLugaresDestacados();
    await cargarCiudades();
    await cargarNegocios();
  })();
})();
