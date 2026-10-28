(function () {
  const estadoCargando = document.getElementById('estado-cargando');
  const estadoNoAuth = document.getElementById('estado-no-auth');
  const estadoNoOrg = document.getElementById('estado-no-org');
  const estadoForm = document.getElementById('estado-form');
  const form = document.querySelector('[data-form-negocio]');
  if (!estadoCargando || !estadoNoAuth || !estadoNoOrg || !estadoForm || !form) return;

  const botonEnviar = form.querySelector('button[type="submit"]');
  const mensaje = form.querySelector('[data-mensaje]');
  const selectCiudad = form.querySelector('[name="ciudadId"]');
  const inputImagenPrincipal = form.querySelector('[name="imagenPrincipal"]');
  const previewImagenPrincipal = form.querySelector('[data-imagen-principal-preview]');
  const tiposImagen = ['image/jpeg', 'image/png', 'image/webp'];
  const maxBytes = 5 * 1024 * 1024;
  let imagenPrincipalUrl = '';
  let colaSubidas = Promise.resolve();

  function mostrarEstado(estado) {
    estadoCargando.hidden = estado !== estadoCargando;
    estadoNoAuth.hidden = estado !== estadoNoAuth;
    estadoNoOrg.hidden = estado !== estadoNoOrg;
    estadoForm.hidden = estado !== estadoForm;
  }

  function listaDe(respuesta) {
    if (Array.isArray(respuesta)) return respuesta;
    if (Array.isArray(respuesta?.value)) return respuesta.value;
    if (Array.isArray(respuesta?.data)) return respuesta.data;
    if (Array.isArray(respuesta?.ciudades)) return respuesta.ciudades;
    return [];
  }

  function mostrarMensaje(texto, tipo) {
    mensaje.textContent = texto;
    mensaje.dataset.tipo = tipo;
  }

  function mostrarError(elemento, texto) {
    const esMensajeError = elemento.matches('[data-plato-error], [data-error]');
    const control = esMensajeError
      ? elemento.closest('.campo')?.querySelector('input, select, textarea')
      : elemento;
    const error = esMensajeError
      ? elemento
      : form.querySelector(`[data-error="${elemento.name}"]`);
    if (control) control.setAttribute('aria-invalid', texto ? 'true' : 'false');
    if (error) error.textContent = texto;
  }

  function limpiarErrores() {
    form.querySelectorAll('[data-error], [data-plato-error]').forEach((error) => {
      error.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((control) => {
      control.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('[data-slot]').forEach((slot) => {
      slot.removeAttribute('aria-invalid');
    });
  }

  function encolarSubida(file, carpeta, input, preview, onSuccess, onError, onFinally = () => {}) {
    if (!file) return;
    if (!tiposImagen.includes(file.type)) {
      onError('Formato no soportado. Usa JPG, PNG o WebP.');
      input.value = '';
      onFinally();
      return;
    }
    if (file.size > maxBytes) {
      onError('La imagen supera el límite de 5 MB.');
      input.value = '';
      onFinally();
      return;
    }

    input.disabled = true;
    input.setAttribute('aria-busy', 'true');
    onError('');
    colaSubidas = colaSubidas.then(async () => {
      try {
        const subida = await AC_API.subirImagen(file, carpeta);
        if (!subida?.url) throw new Error('No se obtuvo la URL de la imagen subida.');
        onSuccess(subida.url);
        preview.src = subida.url;
        preview.hidden = false;
      } catch (error) {
        onError(error.message || 'No se pudo subir la imagen.');
        input.value = '';
      } finally {
        input.disabled = false;
        input.removeAttribute('aria-busy');
        onFinally();
      }
    });
  }

  function limpiarSlot(slot) {
    slot.querySelector('[data-plato-nombre]').value = '';
    slot.querySelector('[data-plato-precio]').value = '';
    const imagen = slot.querySelector('[data-plato-imagen]');
    imagen.value = '';
    imagen.disabled = false;
    imagen.removeAttribute('aria-busy');
    const preview = slot.querySelector('[data-plato-preview]');
    preview.removeAttribute('src');
    preview.hidden = true;
    slot.querySelector('[data-limpiar-plato]').disabled = false;
    slot.querySelectorAll('[data-plato-error]').forEach((elemento) => {
      elemento.textContent = '';
    });
    slot.querySelectorAll('[aria-invalid="true"]').forEach((control) => {
      control.removeAttribute('aria-invalid');
    });
    slot.dataset.imagenUrl = '';
  }

  function inicializarSlots() {
    form.querySelectorAll('[data-slot]').forEach((slot) => {
      const nombre = slot.querySelector('[data-plato-nombre]');
      const precio = slot.querySelector('[data-plato-precio]');
      const inputImagen = slot.querySelector('[data-plato-imagen]');
      const preview = slot.querySelector('[data-plato-preview]');
      const botonQuitar = slot.querySelector('[data-limpiar-plato]');

      inputImagen.addEventListener('change', () => {
        const file = inputImagen.files?.[0];
        if (!file) return;
        slot.dataset.imagenUrl = '';
        preview.removeAttribute('src');
        preview.hidden = true;
        botonQuitar.disabled = true;
        encolarSubida(
          file,
          'negocios',
          inputImagen,
          preview,
          (url) => { slot.dataset.imagenUrl = url; },
          (error) => mostrarError(slot.querySelector('[data-plato-error="imagen"]'), error),
          () => { botonQuitar.disabled = false; },
        );
      });

      botonQuitar.addEventListener('click', () => limpiarSlot(slot));
      [nombre, precio].forEach((control) => {
        control.addEventListener('input', () => {
          const error = slot.querySelector(`[data-plato-error="${control === nombre ? 'nombre' : 'precio'}"]`);
          mostrarError(error, '');
        });
      });
    });
  }

  async function cargarCiudades() {
    const ciudades = listaDe(await AC_API.listarCiudades());
    if (ciudades.length === 0) throw new Error('No hay ciudades disponibles.');
    selectCiudad.innerHTML = '<option value="">Selecciona una ciudad</option>' +
      ciudades.map((ciudad) => {
        const option = document.createElement('option');
        option.value = String(ciudad.id);
        option.textContent = ciudad.nombre;
        return option.outerHTML;
      }).join('');
    selectCiudad.disabled = false;
  }

  function validarCampo(nombre, predicado, error) {
    const control = form.elements.namedItem(nombre);
    const valido = predicado(control.value);
    mostrarError(control, valido ? '' : error);
    return valido;
  }

  function validarFormulario() {
    limpiarErrores();
    let valido = true;
    const validar = (nombre, predicado, error) => {
      valido = validarCampo(nombre, predicado, error) && valido;
    };
    validar('nombre', (value) => value.trim().length >= 3 && value.trim().length <= 150, 'El nombre debe tener entre 3 y 150 caracteres.');
    validar('descripcion', (value) => value.trim().length >= 10 && value.trim().length <= 2000, 'La descripción debe tener entre 10 y 2000 caracteres.');
    validar('categoria', Boolean, 'Selecciona una categoría.');
    validar('ciudadId', Boolean, 'Selecciona una ciudad.');
    validar('direccion', (value) => value.trim().length >= 5 && value.trim().length <= 300, 'La dirección debe tener entre 5 y 300 caracteres.');

    const precioPromedio = form.elements.namedItem('precioPromedio');
    if (precioPromedio.value !== '') {
      validar('precioPromedio', (value) => Number.isInteger(Number(value)) && Number(value) >= 0, 'El precio promedio debe ser un entero mayor o igual a 0.');
    }
    validar('horarioAtencion', (value) => value.length <= 200, 'El horario no puede superar 200 caracteres.');
    validar('telefono', (value) => value.length <= 20, 'El teléfono no puede superar 20 caracteres.');
    validar('whatsapp', (value) => value.length <= 20, 'El WhatsApp no puede superar 20 caracteres.');
    validar('instagram', (value) => value.length <= 100, 'Instagram no puede superar 100 caracteres.');

    const platos = [];
    form.querySelectorAll('[data-slot]').forEach((slot) => {
      const nombre = slot.querySelector('[data-plato-nombre]');
      const precio = slot.querySelector('[data-plato-precio]');
      const imagenUrl = slot.dataset.imagenUrl || '';
      const hayDatos = nombre.value.trim() !== '' ||
        precio.value !== '' ||
        imagenUrl !== '' ||
        slot.querySelector('[data-plato-imagen]').files.length > 0;
      if (!hayDatos) return;

      let platoValido = true;
      if (nombre.value.trim().length < 2 || nombre.value.trim().length > 100) {
        mostrarError(slot.querySelector('[data-plato-error="nombre"]'), 'El nombre debe tener entre 2 y 100 caracteres.');
        platoValido = false;
      }
      if (!Number.isInteger(Number(precio.value)) || Number(precio.value) < 0 || precio.value === '') {
        mostrarError(slot.querySelector('[data-plato-error="precio"]'), 'Indica un precio entero mayor o igual a 0.');
        platoValido = false;
      }
      if (!imagenUrl) {
        mostrarError(slot.querySelector('[data-plato-error="imagen"]'), 'Sube una foto para completar este plato.');
        platoValido = false;
      }
      if (platoValido) {
        platos.push({
          nombre: nombre.value.trim(),
          precio: Number(precio.value),
          imagenUrl,
        });
      } else {
        slot.setAttribute('aria-invalid', 'true');
        valido = false;
      }
    });
    return { valido, platos };
  }

  inputImagenPrincipal.addEventListener('change', () => {
    const file = inputImagenPrincipal.files?.[0];
    if (!file) {
      imagenPrincipalUrl = '';
      previewImagenPrincipal.hidden = true;
      previewImagenPrincipal.removeAttribute('src');
      mostrarError(form.querySelector('[data-error="imagenPrincipal"]'), '');
      return;
    }
    imagenPrincipalUrl = '';
    previewImagenPrincipal.removeAttribute('src');
    previewImagenPrincipal.hidden = true;
    encolarSubida(
      file,
      'negocios',
      inputImagenPrincipal,
      previewImagenPrincipal,
      (url) => { imagenPrincipalUrl = url; },
      (error) => mostrarError(form.querySelector('[data-error="imagenPrincipal"]'), error),
    );
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    botonEnviar.disabled = true;
    botonEnviar.setAttribute('aria-busy', 'true');
    form.setAttribute('aria-busy', 'true');
    try {
      await colaSubidas;
      const resultado = validarFormulario();
      if (!resultado.valido) {
        mostrarMensaje('Revisa los campos marcados antes de publicar.', 'error');
        return;
      }

      const payload = {
        nombre: form.elements.namedItem('nombre').value.trim(),
        descripcion: form.elements.namedItem('descripcion').value.trim(),
        direccion: form.elements.namedItem('direccion').value.trim(),
        ciudadId: Number(selectCiudad.value),
        categoria: form.elements.namedItem('categoria').value,
        ...(form.elements.namedItem('telefono').value.trim()
          ? { telefono: form.elements.namedItem('telefono').value.trim() }
          : {}),
        ...(form.elements.namedItem('whatsapp').value.trim()
          ? { whatsapp: form.elements.namedItem('whatsapp').value.trim() }
          : {}),
        ...(form.elements.namedItem('instagram').value.trim()
          ? { instagram: form.elements.namedItem('instagram').value.trim() }
          : {}),
        ...(form.elements.namedItem('horarioAtencion').value.trim()
          ? { horarioAtencion: form.elements.namedItem('horarioAtencion').value.trim() }
          : {}),
        ...(form.elements.namedItem('precioPromedio').value !== ''
          ? { precioPromedio: Number(form.elements.namedItem('precioPromedio').value) }
          : {}),
        ...(imagenPrincipalUrl ? { imagenPrincipalUrl } : {}),
        ...(resultado.platos.length > 0 ? { platos: resultado.platos } : {}),
      };

      mostrarMensaje('Publicando negocio...', 'info');
      const respuesta = await AC_API.crearNegocio(payload);
      mostrarMensaje(respuesta.mensaje || 'Negocio publicado correctamente.', 'ok');
      window.setTimeout(() => {
        if (respuesta.negocio?.slug) {
          window.location.href = `negocio.html?slug=${encodeURIComponent(respuesta.negocio.slug)}`;
        } else {
          window.location.href = 'sabores.html';
        }
      }, 1200);
    } catch (error) {
      mostrarMensaje(`No se pudo publicar el negocio: ${error.message}`, 'error');
    } finally {
      botonEnviar.disabled = false;
      botonEnviar.removeAttribute('aria-busy');
      form.removeAttribute('aria-busy');
    }
  });

  form.querySelectorAll('[name]').forEach((control) => {
    control.addEventListener('input', () => {
      if (control.matches('input, select, textarea')) mostrarError(control, '');
    });
  });

  inicializarSlots();

  (async () => {
    mostrarEstado(estadoCargando);
    if (!AC_API.getToken()) {
      mostrarEstado(estadoNoAuth);
      return;
    }

    try {
      const perfil = await AC_API.perfil();
      if (perfil?.rol !== 'ORGANIZADOR') {
        mostrarEstado(estadoNoOrg);
        return;
      }
      mostrarEstado(estadoForm);
      await cargarCiudades();
    } catch (error) {
      if (error.status === 401) {
        window.location.href = 'login.html?next=publicar-negocio.html';
        return;
      }
      mostrarEstado(estadoForm);
      selectCiudad.innerHTML = '<option value="">Error al cargar ciudades</option>';
      mostrarMensaje(`No se pudo validar la cuenta: ${error.message}`, 'error');
    }
  })();
})();
