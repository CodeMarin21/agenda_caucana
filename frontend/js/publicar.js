/**
 * Agenda Caucana — Publicar evento.
 *
 * Flujo:
 *  1. Carga categorías y ciudades al iniciar.
 *  2. Al cambiar ciudad, carga lugares.
 *  3. Al enviar: sube imagen (si hay) → obtiene URL → POST /api/eventos.
 *  4. En éxito, redirige a mis-eventos.html.
 */
(function () {
  const form = document.querySelector('[data-form-publicar]');
  if (!form) return;

  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('../login.html')) return;

  const mensaje = document.querySelector('[data-form-publicar-mensaje]');
  const selectCategoria = document.getElementById('categoriaId');
  const selectCiudad = document.getElementById('ciudadId');
  const selectLugar = document.getElementById('lugarId');
  const inputLugarTexto = document.getElementById('lugarTexto');
  const inputImagen = document.getElementById('imagen');
  const previewImagen = document.getElementById('previewImagen');
  const previewImagenImg = document.getElementById('previewImagenImg');
  const inputFechaInicio = document.getElementById('fechaInicio');
  const inputFechaFin = document.getElementById('fechaFin');
  const radiosAcceso = form.querySelectorAll('input[name="tipoAcceso"]');
  const grupoPrecio = document.getElementById('grupoPrecio');
  const botonEnviar = form.querySelector('button[type="submit"]');
  const sidebarNombre = document.querySelector('[data-sidebar-nombre]');
  const sidebarInicial = document.querySelector('[data-sidebar-inicial]');
  let puedePublicar = false;

  /* ── Utilidades ─────────────────────────────────── */

  function pintarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.style.color =
      tipo === 'error'  ? 'var(--color-rechazo)' :
      tipo === 'ok'     ? 'var(--color-patina)'  :
                          'var(--tinta-55)';
  }

  function listaDe(respuesta) {
    // Normaliza respuestas que pueden ser array directo o envoltorios
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta?.value)) return respuesta.value;
    if (Array.isArray(respuesta?.data)) return respuesta.data;
    if (Array.isArray(respuesta?.categorias)) return respuesta.categorias;
    if (Array.isArray(respuesta?.ciudades)) return respuesta.ciudades;
    if (Array.isArray(respuesta?.lugares)) return respuesta.lugares;
    return [];
  }

  function actualizarCampoLugar() {
    const esLugarManual = selectLugar.value === '__otro__';
    inputLugarTexto.hidden = !esLugarManual;
    inputLugarTexto.required = esLugarManual;
    selectLugar.required = !esLugarManual;
    if (!esLugarManual) inputLugarTexto.value = '';
  }

  selectLugar.addEventListener('change', actualizarCampoLugar);

  /* ── Carga de selects ───────────────────────────── */

  async function cargarCategorias() {
    try {
      const respuesta = await AC_API.listarCategorias();
      const lista = listaDe(respuesta);
      if (lista.length === 0) {
        selectCategoria.innerHTML = '<option value="">No hay categorías disponibles</option>';
        return;
      }
      selectCategoria.innerHTML = '<option value="">Selecciona una categoría</option>' +
        lista.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join('');
      selectCategoria.disabled = false;
    } catch (e) {
      selectCategoria.innerHTML = '<option value="">Error al cargar categorías</option>';
      console.error('cargarCategorias', e);
    }
  }

  async function cargarCiudades() {
    try {
      const respuesta = await AC_API.listarCiudades();
      const lista = listaDe(respuesta);
      if (lista.length === 0) {
        selectCiudad.innerHTML = '<option value="">No hay ciudades disponibles</option>';
        return;
      }
      selectCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>' +
        lista.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join('');
      selectCiudad.disabled = false;
    } catch (e) {
      selectCiudad.innerHTML = '<option value="">Error al cargar ciudades</option>';
      console.error('cargarCiudades', e);
    }
  }

  async function cargarLugares(ciudadId) {
    selectLugar.disabled = true;
    selectLugar.innerHTML = '<option value="">Cargando lugares...</option>';
    actualizarCampoLugar();
    try {
      const respuesta = await AC_API.listarLugares(ciudadId);
      const lista = listaDe(respuesta);
      if (lista.length === 0) {
        selectLugar.innerHTML = '<option value="">No hay lugares en esta ciudad</option>' +
          '<option value="__otro__">Otro (escribir manualmente)</option>';
      } else {
        selectLugar.innerHTML = '<option value="">Selecciona un lugar</option>' +
          lista.map((l) => `<option value="${l.id}">${l.nombre}</option>`).join('') +
          '<option value="__otro__">Otro (escribir manualmente)</option>';
      }
      selectLugar.disabled = false;
      actualizarCampoLugar();
    } catch (e) {
      selectLugar.innerHTML = '<option value="">Error al cargar lugares</option>' +
        '<option value="__otro__">Otro (escribir manualmente)</option>';
      selectLugar.disabled = false;
      actualizarCampoLugar();
      console.error('cargarLugares', e);
    }
  }

  /* ── Preview de imagen ──────────────────────────── */

  inputImagen.addEventListener('change', () => {
    const archivo = inputImagen.files[0];
    if (!archivo) {
      previewImagen.style.display = 'none';
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      pintarMensaje('La imagen supera 5MB. Elige una más liviana.', 'error');
      inputImagen.value = '';
      previewImagen.style.display = 'none';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImagenImg.src = e.target.result;
      previewImagen.style.display = 'block';
    };
    reader.readAsDataURL(archivo);
  });

  /* ── Radio libre/pago ───────────────────────────── */

  radiosAcceso.forEach((radio) => {
    radio.addEventListener('change', () => {
      const esPago = form.querySelector('input[name="tipoAcceso"]:checked').value === 'pago';
      grupoPrecio.style.display = esPago ? 'flex' : 'none';
      if (!esPago) {
        const inputPrecio = document.getElementById('precioReferencial');
        if (inputPrecio) inputPrecio.value = '';
      }
    });
  });

  /* ── Fechas: min = ahora ─────────────────────────── */

  function setMinFechaInicio() {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset();
    const ahoraLocal = new Date(ahora.getTime() - offset * 60_000);
    const iso = ahoraLocal.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    inputFechaInicio.min = iso;
    inputFechaFin.min = iso;
  }

  inputFechaInicio.addEventListener('change', () => {
    if (inputFechaInicio.value) {
      inputFechaFin.min = inputFechaInicio.value;
      if (inputFechaFin.value && inputFechaFin.value < inputFechaInicio.value) {
        inputFechaFin.value = '';
      }
    }
  });

  /* ── Envío ──────────────────────────────────────── */

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (!puedePublicar) {
      pintarMensaje('Tu cuenta debe estar verificada para publicar eventos.', 'error');
      return;
    }
    pintarMensaje('Validando...', 'info');
    botonEnviar.disabled = true;

    try {
      const datos = new FormData(form);
      const tipoAcceso = form.querySelector('input[name="tipoAcceso"]:checked').value;

      // Validaciones cliente
      const titulo = (datos.get('titulo') || '').trim();
      const descripcion = (datos.get('descripcion') || '').trim();
      const categoriaId = Number(datos.get('categoriaId'));
      const ciudadId = Number(datos.get('ciudadId'));
      const lugarSeleccionado = datos.get('lugarId');
      const esLugarManual = lugarSeleccionado === '__otro__';
      const lugarId = esLugarManual ? undefined : Number(lugarSeleccionado);
      const lugarTexto = String(datos.get('lugarTexto') || '').trim();
      const fechaInicio = datos.get('fechaInicio');

      if (titulo.length < 3) throw new Error('El título debe tener al menos 3 caracteres.');
      if (descripcion.length < 10) throw new Error('La descripción debe tener al menos 10 caracteres.');
      if (!categoriaId) throw new Error('Selecciona una categoría.');
      if (!ciudadId) throw new Error('Selecciona una ciudad.');
      if (esLugarManual) {
        if (lugarTexto.length < 3 || lugarTexto.length > 150) {
          throw new Error('El nombre del lugar debe tener entre 3 y 150 caracteres.');
        }
      } else if (!lugarId) {
        throw new Error('Selecciona un lugar.');
      }
      if (!fechaInicio) throw new Error('La fecha de inicio es obligatoria.');

      if (new Date(fechaInicio) < new Date()) {
        throw new Error('La fecha de inicio no puede ser anterior al momento actual.');
      }

      // 1. Subir imagen si hay
      let imagenUrl;
      const archivoImagen = datos.get('imagen');
      if (archivoImagen && archivoImagen.size > 0) {
        pintarMensaje('Subiendo afiche...', 'info');
        const subida = await AC_API.subirImagen(archivoImagen, 'eventos');
        imagenUrl = subida.url;
        if (!imagenUrl) throw new Error('No se obtuvo la URL de la imagen subida.');
      }

      // 2. Armar payload
      const payload = {
        titulo,
        descripcion,
        categoriaId,
        ciudadId,
        ...(esLugarManual ? { lugarTexto } : { lugarId }),
        fechaInicio,
        fechaFin: datos.get('fechaFin') || undefined,
        direccion: (datos.get('direccion') || '').trim() || undefined,
        imagenUrl,
        precioReferencial: tipoAcceso === 'pago'
          ? Number(datos.get('precioReferencial')) || 0
          : 0,
        urlExternaBoletas: (datos.get('urlExternaBoletas') || '').trim() || undefined,
        esMayorDeEdad: datos.get('esMayorDeEdad') === 'true',
      };

      pintarMensaje('Publicando evento...', 'info');
      await AC_API.crearEvento(payload);

      pintarMensaje('✓ Evento enviado. Será visible en la agenda una vez el equipo lo apruebe.', 'ok');
      form.reset();
      actualizarCampoLugar();
      previewImagen.style.display = 'none';
      grupoPrecio.style.display = 'none';

      setTimeout(() => { window.location.href = 'mis-eventos.html'; }, 1800);
    } catch (error) {
      pintarMensaje(`No se pudo publicar el evento: ${error.message}`, 'error');
      botonEnviar.disabled = false;
    }
  });

  /* ── Init ───────────────────────────────────────── */

  botonEnviar.disabled = true;
  form.setAttribute('aria-busy', 'true');

  (async () => {
    try {
      const perfil = await AC_API.perfilOrganizador();
      if (sidebarNombre) sidebarNombre.textContent = perfil.nombreEntidad || 'Organizador';
      if (sidebarInicial) {
        sidebarInicial.textContent = (perfil.nombreEntidad || 'Organizador')
          .trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]).join('').toUpperCase();
      }
      if (perfil.estado !== 'VERIFICADO' || perfil.vetado) {
        window.location.replace('perfil.html');
        return;
      }

      puedePublicar = true;
      botonEnviar.disabled = false;
      form.removeAttribute('aria-busy');
      setMinFechaInicio();
      await Promise.all([cargarCategorias(), cargarCiudades()]);

      selectCiudad.addEventListener('change', () => {
        const ciudadId = selectCiudad.value;
        if (!ciudadId) {
          selectLugar.innerHTML = '<option value="">Primero elige una ciudad</option>';
          selectLugar.disabled = true;
          actualizarCampoLugar();
          return;
        }
        cargarLugares(ciudadId);
      });
    } catch (error) {
      pintarMensaje(`No se pudo validar tu cuenta: ${error.message}`, 'error');
    }
  })();
})();