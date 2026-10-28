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

  const grid = document.getElementById('gridNegocios');
  const cargando = document.getElementById('cargandoNegocios');
  const estadoVacio = document.getElementById('estadoVacioNegocios');
  const sinResultados = document.getElementById('sinResultadosNegocios');
  const estadoError = document.getElementById('estadoErrorNegocios');
  const mensajeError = document.getElementById('mensajeErrorNegocios');
  const filtroCategoria = document.getElementById('filtroCategoriaNegocio');
  const filtroEstado = document.getElementById('filtroEstadoNegocio');
  const sidebarNombre = document.querySelector('[data-sidebar-nombre]');
  const sidebarInicial = document.querySelector('[data-sidebar-inicial]');
  const botonMenu = document.querySelector('[data-menu-boton]');
  const sidebar = document.querySelector('[data-sidebar]');

  const etiquetasCategoria = {
    TRADICIONAL_CAUCANA: 'Tradicional caucana',
    COMIDA_RAPIDA: 'Comida rápida',
    PARRILLA: 'Parrilla',
    PIZZA: 'Pizza',
    SUSHI: 'Sushi',
    POSTRES: 'Postres',
    CAFETERIA: 'Cafetería',
    BEBIDAS: 'Bebidas',
    VEGETARIANA: 'Vegetariana',
    OTRO: 'Otro',
  };
  const etiquetasEstado = {
    PENDIENTE: 'Pendiente',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
  };

  let negocios = [];
  let cargaCompleta = false;
  let redireccionandoPor403 = false;

  function manejar403(error) {
    if (error.status !== 403) return false;
    if (!redireccionandoPor403) {
      redireccionandoPor403 = true;
      alert('Tu sesión ha expirado. Vuelve a iniciar sesión.');
      window.location.replace('../login.html');
    }
    return true;
  }

  function normalizarNegocios(respuesta) {
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta?.negocios)) return respuesta.negocios;
    if (Array.isArray(respuesta?.data)) return respuesta.data;
    return [];
  }

  function categoriaLegible(categoria) {
    return etiquetasCategoria[categoria] || 'Otra categoría';
  }

  function poblarFiltroCategorias() {
    const categorias = [...new Set(negocios.map((negocio) => negocio.categoria).filter(Boolean))]
      .sort((a, b) => categoriaLegible(a).localeCompare(categoriaLegible(b), 'es-CO'));
    const seleccionActual = filtroCategoria.value;
    filtroCategoria.replaceChildren(new Option('Todas las categorías', ''));
    categorias.forEach((categoria) => {
      filtroCategoria.add(new Option(categoriaLegible(categoria), categoria));
    });
    if (categorias.includes(seleccionActual)) filtroCategoria.value = seleccionActual;
  }

  function negociosFiltrados() {
    return negocios.filter((negocio) => {
      const categoriaCoincide = !filtroCategoria.value || negocio.categoria === filtroCategoria.value;
      const estadoCoincide = !filtroEstado.value || negocio.estadoPublicacion === filtroEstado.value;
      return categoriaCoincide && estadoCoincide;
    });
  }

  function crearPlaceholder(nombre, contenedor) {
    contenedor.classList.add('tarjeta-negocio-panel__imagen--vacio');
    const inicial = String(nombre || '').trim().charAt(0).toLocaleUpperCase('es-CO') || '?';
    contenedor.replaceChildren(document.createTextNode(inicial));
  }

  function crearTarjeta(negocio) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'tarjeta-negocio-panel';

    const imagenContenedor = document.createElement('div');
    imagenContenedor.className = 'tarjeta-negocio-panel__imagen';
    if (negocio.imagenPrincipalUrl) {
      const imagen = document.createElement('img');
      imagen.src = negocio.imagenPrincipalUrl;
      imagen.alt = `Imagen de ${negocio.nombre || 'tu negocio'}`;
      imagen.loading = 'lazy';
      imagen.addEventListener('error', () => crearPlaceholder(negocio.nombre, imagenContenedor), { once: true });
      imagenContenedor.appendChild(imagen);
    } else {
      crearPlaceholder(negocio.nombre, imagenContenedor);
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'tarjeta-negocio-panel__cuerpo';

    const nombre = document.createElement('h3');
    nombre.className = 'tarjeta-negocio-panel__nombre';
    nombre.textContent = negocio.nombre || 'Negocio sin nombre';

    const categoria = document.createElement('p');
    categoria.className = 'tarjeta-negocio-panel__categoria';
    categoria.textContent = categoriaLegible(negocio.categoria);

    const estado = document.createElement('span');
    const estadoPublicacion = negocio.estadoPublicacion || 'PENDIENTE';
    const claseEstado = {
      PENDIENTE: 'estado-pendiente',
      APROBADO: 'estado-aprobado',
      RECHAZADO: 'estado-rechazado',
    }[estadoPublicacion] || 'estado-pendiente';
    estado.className = `estado ${claseEstado}`;
    estado.textContent = etiquetasEstado[estadoPublicacion] || 'Estado no disponible';

    cuerpo.append(nombre, categoria, estado);

    if (estadoPublicacion === 'RECHAZADO' && negocio.motivoRechazo) {
      const motivo = document.createElement('p');
      motivo.className = 'tarjeta-negocio-panel__motivo';
      motivo.textContent = `Motivo: ${negocio.motivoRechazo}`;
      cuerpo.appendChild(motivo);
    }

    const acciones = document.createElement('div');
    acciones.className = 'tarjeta-negocio-panel__acciones';
    if (estadoPublicacion === 'APROBADO' && negocio.slug) {
      const ver = document.createElement('a');
      ver.className = 'boton boton-secundario boton-sm';
      ver.href = `../negocio.html?slug=${encodeURIComponent(negocio.slug)}`;
      ver.textContent = 'Ver negocio';
      acciones.appendChild(ver);
    }

    const eliminar = document.createElement('button');
    eliminar.type = 'button';
    eliminar.className = 'boton boton-rechazo boton-sm';
    eliminar.dataset.eliminar = String(negocio.id);
    eliminar.textContent = 'Eliminar';
    acciones.appendChild(eliminar);

    cuerpo.appendChild(acciones);
    tarjeta.append(imagenContenedor, cuerpo);
    return tarjeta;
  }

  function renderizar() {
    if (!cargaCompleta) return;
    const filtrados = negociosFiltrados();
    grid.replaceChildren();
    cargando.hidden = true;
    estadoVacio.hidden = negocios.length !== 0;
    sinResultados.hidden = negocios.length === 0 || filtrados.length !== 0;
    estadoError.hidden = true;
    grid.hidden = negocios.length === 0 || filtrados.length === 0;
    filtrados.forEach((negocio) => grid.appendChild(crearTarjeta(negocio)));
  }

  async function cargarNegocios() {
    cargaCompleta = false;
    filtroCategoria.disabled = true;
    filtroEstado.disabled = true;
    cargando.hidden = false;
    estadoVacio.hidden = true;
    sinResultados.hidden = true;
    estadoError.hidden = true;
    grid.hidden = true;
    grid.replaceChildren();

    try {
      negocios = normalizarNegocios(await AC_API.misNegocios());
      poblarFiltroCategorias();
      cargaCompleta = true;
      filtroCategoria.disabled = false;
      filtroEstado.disabled = false;
      renderizar();
    } catch (error) {
      if (manejar403(error)) return;
      mensajeError.textContent = `No se pudieron cargar tus negocios: ${error.message}`;
      cargando.hidden = true;
      estadoError.hidden = false;
      console.error('No se pudieron cargar los negocios del organizador:', error);
    }
  }

  async function eliminarNegocio(id, boton) {
    const negocio = negocios.find((item) => String(item.id) === String(id));
    if (!negocio) return;
    if (!confirm(`¿Eliminar "${negocio.nombre}"?\n\nEsta acción es permanente y no se puede deshacer.`)) {
      return;
    }

    boton.disabled = true;
    boton.textContent = 'Eliminando…';
    try {
      await AC_API.eliminarNegocio(id);
      negocios = negocios.filter((item) => String(item.id) !== String(id));
      poblarFiltroCategorias();
      renderizar();
      alert('El negocio se eliminó correctamente.');
    } catch (error) {
      if (manejar403(error)) return;
      alert(`No se pudo eliminar el negocio: ${error.message}`);
      boton.disabled = false;
      boton.textContent = 'Eliminar';
      console.error('No se pudo eliminar el negocio:', error);
    }
  }

  async function cargarPerfilSidebar() {
    try {
      const perfil = await AC_API.perfil();
      const nombre = perfil?.organizador?.nombreEntidad || perfil?.nombre || 'Organizador';
      sidebarNombre.textContent = nombre;
      sidebarInicial.textContent = nombre.trim().slice(0, 2).toLocaleUpperCase('es-CO');
    } catch (error) {
      if (manejar403(error)) return;
      console.warn('No se pudo cargar el perfil del organizador para el sidebar:', error.message);
    }
  }

  grid.addEventListener('click', (evento) => {
    const boton = evento.target.closest('[data-eliminar]');
    if (boton) eliminarNegocio(boton.dataset.eliminar, boton);
  });
  filtroCategoria.addEventListener('change', renderizar);
  filtroEstado.addEventListener('change', renderizar);
  document.querySelector('[data-reintentar]').addEventListener('click', cargarNegocios);
  if (botonMenu && sidebar) {
    botonMenu.addEventListener('click', () => {
      const abierto = sidebar.classList.toggle('abierto');
      botonMenu.setAttribute('aria-expanded', String(abierto));
      botonMenu.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    });
  }

  cargarPerfilSidebar();
  cargarNegocios();
})();
