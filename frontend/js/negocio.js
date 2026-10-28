(function () {
  const estado = document.querySelector('[data-negocio-estado]');
  const detalle = document.querySelector('[data-negocio-detalle]');
  const slug = new URLSearchParams(window.location.search).get('slug');
  const modal = document.querySelector('[data-modal-resena]');
  const formulario = document.querySelector('[data-form-resena]');
  const botonesCalificar = document.querySelectorAll('[data-abrir-resena]');
  const botonesEstrellas = Array.from(document.querySelectorAll('[data-estrellas]'));
  const textoError = document.querySelector('[data-error-resena]');
  const botonEnviar = document.querySelector('[data-enviar-resena]');
  const comentario = document.querySelector('[data-comentario-resena]');
  const toast = document.querySelector('[data-toast-negocio]');
  const STORAGE_KEY = 'calificacionesRecientes';
  const VENTANA_CALIFICACION = 24 * 60 * 60 * 1000;
  let negocio = null;
  let estrellasSeleccionadas = 0;
  let totalCalificaciones = 0;
  let promedioEstrellas = 0;
  let temporizadorToast;

  if (!estado || !detalle || !modal || !formulario) return;

  function etiquetaCategoria(categoria) {
    const etiquetas = {
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
    return etiquetas[categoria] || String(categoria || 'Negocio').replaceAll('_', ' ');
  }

  function formarEstrellas(promedio) {
    const activas = Math.max(0, Math.min(5, Math.round(Number(promedio) || 0)));
    return `${'★'.repeat(activas)}${'☆'.repeat(5 - activas)}`;
  }

  function formatearPrecio(precio) {
    return precio == null ? 'No disponible' : `$${Number(precio).toLocaleString('es-CO')}`;
  }

  function leerCalificacionesRecientes() {
    try {
      const valor = localStorage.getItem(STORAGE_KEY);
      if (!valor) return {};
      const datos = JSON.parse(valor);
      return datos && typeof datos === 'object' && !Array.isArray(datos) ? datos : {};
    } catch (error) {
      console.error('No se pudieron leer las calificaciones recientes guardadas:', error);
      return {};
    }
  }

  function guardarCalificacionReciente(id) {
    const recientes = leerCalificacionesRecientes();
    recientes[id] = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recientes));
    } catch (error) {
      console.error('No se pudo guardar la fecha de calificación en el almacenamiento local:', error);
    }
  }

  function tieneCalificacionReciente(id) {
    const fecha = Number(leerCalificacionesRecientes()[id]);
    return Number.isFinite(fecha) && Date.now() - fecha >= 0 && Date.now() - fecha < VENTANA_CALIFICACION;
  }

  function mostrarToast(mensaje) {
    toast.textContent = mensaje;
    toast.hidden = false;
    window.clearTimeout(temporizadorToast);
    temporizadorToast = window.setTimeout(() => {
      toast.hidden = true;
    }, 3500);
  }

  function actualizarResumenRating() {
    document.querySelector('[data-rating-estrellas]').textContent = formarEstrellas(promedioEstrellas);
    document.querySelector('[data-rating-promedio]').textContent = totalCalificaciones
      ? promedioEstrellas.toFixed(1)
      : '—';
    document.querySelector('[data-rating-total]').textContent = totalCalificaciones
      ? `${totalCalificaciones} ${totalCalificaciones === 1 ? 'reseña' : 'reseñas'}`
      : 'Sin reseñas';
  }

  function renderizarResenas(calificaciones) {
    const contenedor = document.querySelector('[data-negocio-resenas]');
    contenedor.replaceChildren();
    if (!calificaciones.length) {
      const vacio = document.createElement('p');
      vacio.textContent = 'Aún no hay reseñas. ¡Sé el primero!';
      contenedor.appendChild(vacio);
      return;
    }
    calificaciones.forEach((calificacion) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'resena';
      const cabecera = document.createElement('div');
      cabecera.className = 'resena__cabecera';
      const titulo = document.createElement('strong');
      titulo.textContent = 'Reseña';
      const estrellas = document.createElement('span');
      estrellas.className = 'resena__estrellas';
      estrellas.setAttribute('aria-label', `${calificacion.estrellas} de 5 estrellas`);
      estrellas.textContent = formarEstrellas(calificacion.estrellas);
      cabecera.append(titulo, estrellas);
      tarjeta.appendChild(cabecera);
      if (calificacion.creadoEn) {
        const fecha = new Date(calificacion.creadoEn);
        if (!Number.isNaN(fecha.getTime())) {
          const fechaTexto = document.createElement('p');
          fechaTexto.className = 'rating-total';
          fechaTexto.textContent = fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
          tarjeta.appendChild(fechaTexto);
        }
      }
      if (calificacion.comentario) {
        const texto = document.createElement('p');
        texto.className = 'resena__comentario';
        texto.textContent = calificacion.comentario;
        tarjeta.appendChild(texto);
      }
      contenedor.appendChild(tarjeta);
    });
  }

  function actualizarEstadoCalificacion() {
    const botones = Array.from(botonesCalificar);
    const deshabilitado = tieneCalificacionReciente(negocio.id);
    botones.forEach((boton) => {
      boton.disabled = deshabilitado;
      if (boton.classList.contains('negocio-panel__calificar')) {
        boton.textContent = deshabilitado ? 'Ya calificaste este negocio hoy' : 'Escribir una reseña';
      }
    });
    document.querySelector('[data-estado-calificacion]').textContent = deshabilitado
      ? 'Ya calificaste este negocio hoy.'
      : '';
  }

  function construirImagen() {
    const contenedor = document.querySelector('[data-negocio-imagen]');
    contenedor.replaceChildren();
    if (!negocio.imagenPrincipalUrl) {
      contenedor.classList.add('negocio-detalle__imagen--vacio');
      contenedor.textContent = (negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO');
      contenedor.setAttribute('role', 'img');
      contenedor.setAttribute('aria-label', `Sin imagen para ${negocio.nombre}`);
      return;
    }
    const imagen = document.createElement('img');
    imagen.src = negocio.imagenPrincipalUrl;
    imagen.alt = negocio.nombre;
    imagen.addEventListener('error', () => {
      contenedor.classList.add('negocio-detalle__imagen--vacio');
      contenedor.replaceChildren(document.createTextNode((negocio.nombre || '?').trim().charAt(0).toLocaleUpperCase('es-CO')));
      contenedor.setAttribute('role', 'img');
      contenedor.setAttribute('aria-label', `Sin imagen para ${negocio.nombre}`);
    }, { once: true });
    contenedor.appendChild(imagen);
  }

  function renderizarPlatos() {
    const seccion = document.querySelector('[data-negocio-carta-seccion]');
    const contenedor = document.querySelector('[data-negocio-platos]');
    if (!Array.isArray(negocio.platos) || negocio.platos.length === 0) {
      seccion.hidden = true;
      return;
    }

    seccion.hidden = false;
    contenedor.replaceChildren();
    negocio.platos.forEach((plato) => {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'plato-card';

      const imagenContenedor = document.createElement('div');
      imagenContenedor.className = 'plato-card__imagen';
      const nombre = plato.nombre || '';
      const inicial = nombre.trim().charAt(0).toLocaleUpperCase('es-CO') || '?';
      const mostrarPlaceholder = () => {
        imagenContenedor.classList.add('plato-card__imagen--vacio');
        imagenContenedor.replaceChildren(document.createTextNode(inicial));
      };

      if (plato.imagenUrl) {
        const imagen = document.createElement('img');
        imagen.src = plato.imagenUrl;
        imagen.alt = nombre;
        imagen.loading = 'lazy';
        imagen.addEventListener('error', mostrarPlaceholder, { once: true });
        imagenContenedor.appendChild(imagen);
      } else {
        mostrarPlaceholder();
      }

      const cuerpo = document.createElement('div');
      cuerpo.className = 'plato-card__cuerpo';
      const titulo = document.createElement('h3');
      titulo.className = 'plato-card__nombre';
      titulo.textContent = nombre;
      const precio = document.createElement('p');
      precio.className = 'plato-card__precio';
      precio.textContent = plato.precio == null
        ? 'Precio no disponible'
        : `$${Number(plato.precio).toLocaleString('es-CO')}`;
      cuerpo.append(titulo, precio);
      tarjeta.append(imagenContenedor, cuerpo);
      contenedor.appendChild(tarjeta);
    });
  }

  function enlaceInstagram(valor) {
    if (!valor) return '';
    if (/^https?:\/\//i.test(valor)) {
      try {
        const url = new URL(valor);
        return url.protocol === 'https:' ? url.href : '';
      } catch {
        return '';
      }
    }
    return `https://www.instagram.com/${encodeURIComponent(valor.replace(/^@/, ''))}/`;
  }

  function enlaceWhatsapp(numero) {
    const valor = String(numero || '').trim();
    if (/^https?:\/\//i.test(valor)) {
      try {
        const url = new URL(valor);
        const dominiosPermitidos = ['wa.me', 'www.whatsapp.com', 'api.whatsapp.com', 'web.whatsapp.com'];
        return url.protocol === 'https:' && dominiosPermitidos.includes(url.hostname) ? url.href : '';
      } catch {
        return '';
      }
    }
    const soloDigitos = valor.replace(/\D/g, '');
    if (!soloDigitos) return '';
    return `https://wa.me/${soloDigitos.length === 10 ? `57${soloDigitos}` : soloDigitos}`;
  }

  function configurarContactos() {
    const telefono = document.querySelector('[data-contacto-telefono]');
    const enlaceTelefono = document.querySelector('[data-negocio-telefono]');
    if (negocio.telefono) {
      telefono.hidden = false;
      enlaceTelefono.href = `tel:${String(negocio.telefono).replace(/[^\d+]/g, '')}`;
      enlaceTelefono.textContent = negocio.telefono;
    }

    const whatsapp = document.querySelector('[data-contacto-whatsapp]');
    const enlaceWhatsappNegocio = document.querySelector('[data-negocio-whatsapp]');
    const urlWhatsapp = enlaceWhatsapp(negocio.whatsapp || negocio.telefono);
    if (urlWhatsapp) {
      whatsapp.hidden = false;
      enlaceWhatsappNegocio.href = urlWhatsapp;
    }

    const instagram = document.querySelector('[data-contacto-instagram]');
    const enlaceInstagramNegocio = document.querySelector('[data-negocio-instagram]');
    const urlInstagram = enlaceInstagram(negocio.instagram);
    if (urlInstagram) {
      instagram.hidden = false;
      enlaceInstagramNegocio.href = urlInstagram;
    }
  }

  function configurarMapa() {
    const ciudad = negocio.ciudad?.nombre || 'Popayán';
    const ubicacion = `${negocio.direccion || ''}, ${ciudad}, Colombia`;
    const mapa = document.querySelector('[data-negocio-mapa]');
    const iframe = document.createElement('iframe');
    iframe.src = `https://maps.google.com/maps?q=${encodeURIComponent(ubicacion)}&output=embed`;
    iframe.title = `Mapa de ubicación de ${negocio.nombre}`;
    iframe.loading = 'lazy';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    mapa.replaceChildren(iframe);
    document.querySelector('[data-como-llegar]').href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ubicacion)}`;
  }

  function renderizarNegocio() {
    document.title = `${negocio.nombre} — Sabores de Popayán | Agenda Caucana`;
    document.querySelector('[data-negocio-miga]').textContent = negocio.nombre;
    document.querySelector('[data-negocio-categoria]').textContent = etiquetaCategoria(negocio.categoria);
    document.querySelector('[data-negocio-nombre]').textContent = negocio.nombre;
    document.querySelector('[data-negocio-descripcion]').textContent = negocio.descripcion || 'Este negocio aún no tiene descripción.';
    document.querySelector('[data-negocio-direccion]').textContent = [negocio.direccion, negocio.ciudad?.nombre].filter(Boolean).join(', ');
    document.querySelector('[data-negocio-horario]').textContent = negocio.horarioAtencion || 'Horario no disponible.';
    document.querySelector('[data-negocio-horario-panel]').textContent = negocio.horarioAtencion || 'Horario no disponible.';
    document.querySelector('[data-negocio-precio]').textContent = `${formatearPrecio(negocio.precioPromedio)}${negocio.precioPromedio == null ? '' : ' promedio'}`;
    construirImagen();
    renderizarPlatos();
    configurarContactos();
    configurarMapa();

    promedioEstrellas = Number(negocio.promedioEstrellas) || 0;
    totalCalificaciones = Number(negocio.totalCalificaciones) || 0;
    actualizarResumenRating();
    renderizarResenas(Array.isArray(negocio.calificaciones) ? negocio.calificaciones : []);

    const url = window.location.href;
    const texto = `Mira este lugar en Agenda Caucana: ${negocio.nombre} - ${url}`;
    document.querySelector('[data-compartir-whatsapp]').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    detalle.hidden = false;
    estado.hidden = true;
    actualizarEstadoCalificacion();
  }

  function actualizarSeleccionEstrellas() {
    botonesEstrellas.forEach((boton) => {
      const numero = Number(boton.dataset.estrellas);
      boton.setAttribute('aria-pressed', String(numero <= estrellasSeleccionadas));
      boton.classList.toggle('activa', numero <= estrellasSeleccionadas);
    });
  }

  function abrirModal() {
    if (tieneCalificacionReciente(negocio.id)) {
      actualizarEstadoCalificacion();
      return;
    }
    estrellasSeleccionadas = 0;
    comentario.value = '';
    textoError.textContent = '';
    actualizarSeleccionEstrellas();
    modal.showModal();
    botonesEstrellas[0].focus();
  }

  function agregarResena(calificacion) {
    const reseñas = Array.isArray(negocio.calificaciones) ? negocio.calificaciones.slice() : [];
    reseñas.unshift(calificacion);
    negocio.calificaciones = reseñas.slice(0, 10);
    renderizarResenas(negocio.calificaciones);
  }

  async function cargarNegocio() {
    if (!slug) {
      estado.textContent = 'No se indicó qué negocio quieres consultar.';
      return;
    }
    try {
      negocio = await AC_API.obtenerNegocio(slug);
      if (!negocio || !negocio.id) throw new Error('La respuesta del negocio no tiene el formato esperado');
      renderizarNegocio();
    } catch (error) {
      console.error('No se pudo cargar el negocio:', error);
      estado.textContent = error.status === 404
        ? 'No encontramos este negocio.'
        : 'No fue posible cargar el negocio. Intenta nuevamente más tarde.';
    }
  }

  botonesCalificar.forEach((boton) => boton.addEventListener('click', abrirModal));
  botonesEstrellas.forEach((boton) => {
    boton.addEventListener('click', () => {
      estrellasSeleccionadas = Number(boton.dataset.estrellas);
      actualizarSeleccionEstrellas();
    });
  });
  document.querySelector('[data-cerrar-resena]').addEventListener('click', () => modal.close());
  document.querySelector('[data-cancelar-resena]').addEventListener('click', () => modal.close());

  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    textoError.textContent = '';
    if (!Number.isInteger(estrellasSeleccionadas) || estrellasSeleccionadas < 1 || estrellasSeleccionadas > 5) {
      textoError.textContent = 'Selecciona una calificación de 1 a 5 estrellas.';
      return;
    }
    botonEnviar.disabled = true;
    try {
      const respuesta = await AC_API.calificarNegocio(negocio.id, estrellasSeleccionadas, comentario.value.trim());
      const nuevaCalificacion = respuesta.calificacion || {
        estrellas: estrellasSeleccionadas,
        comentario: comentario.value.trim(),
        creadoEn: new Date().toISOString(),
      };
      const cantidadAnterior = totalCalificaciones;
      promedioEstrellas = ((promedioEstrellas * cantidadAnterior) + Number(nuevaCalificacion.estrellas)) / (cantidadAnterior + 1);
      totalCalificaciones = cantidadAnterior + 1;
      actualizarResumenRating();
      agregarResena(nuevaCalificacion);
      guardarCalificacionReciente(negocio.id);
      actualizarEstadoCalificacion();
      modal.close();
      mostrarToast('¡Gracias por tu reseña!');
    } catch (error) {
      if (error.status === 429) {
        textoError.textContent = 'Ya calificaste este negocio en las últimas 24 horas. Intenta mañana.';
      } else if (error.status === 400) {
        textoError.textContent = error.message || 'Revisa los datos de la reseña.';
      } else {
        console.error('No se pudo enviar la reseña:', error);
        textoError.textContent = error.message || 'No fue posible enviar la reseña. Intenta nuevamente.';
      }
    } finally {
      botonEnviar.disabled = false;
    }
  });

  cargarNegocio();
})();
