/**
 * Perfil del organizador.
 *  - Carga GET /api/organizadores/perfil.
 *  - Rellena el formulario.
 *  - Sube avatar a Cloudinary (carpeta "avatares") cuando se cambia la foto.
 *  - Guarda con PATCH /api/organizadores/perfil.
 *  - Banner dinámico según estado (PENDIENTE/VERIFICADO/SUSPENDIDO/vetado).
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('../login.html')) return;

  const form = document.querySelector('[data-form-perfil]');
  if (!form) return;

  const banner = document.querySelector('[data-banner-estado]');
  const bannerIcono = document.querySelector('[data-banner-icono]');
  const bannerTitulo = document.querySelector('[data-banner-titulo]');
  const bannerTexto = document.querySelector('[data-banner-texto]');

  const avatarPreview = document.querySelector('[data-avatar-preview]');
  const avatarBtn = document.querySelector('[data-avatar-btn]');
  const avatarInput = document.querySelector('[data-avatar-input]');

  const resumenNombre = document.querySelector('[data-resumen-nombre]');
  const resumenCiudad = document.querySelector('[data-resumen-ciudad]');
  const resumenRedes = document.querySelector('[data-resumen-redes]');

  const sidebarNombre = document.querySelector('[data-sidebar-nombre]');
  const sidebarInicial = document.querySelector('[data-sidebar-inicial]');

  const mensaje = document.querySelector('[data-perfil-mensaje]');
  const botonGuardar = document.querySelector('[data-boton-guardar]');
  const docAyuda = document.querySelector('[data-doc-ayuda]');

  const REDES_LABEL = {
    instagram: '📷 Instagram',
    facebook: '📘 Facebook',
    x: '🐦 X',
    tiktok: '🎵 TikTok',
    youtube: '▶️ YouTube',
    whatsapp: '💬 WhatsApp',
    web: '🌐 Sitio web'
  };

  let perfilActual = null;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const iniciales = (nombre) => {
    if (!nombre) return '?';
    return nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  };

  const mostrarMensaje = (texto, tipo) => {
    mensaje.textContent = texto;
    mensaje.className = 'auth-card__mensaje';
    if (tipo === 'ok') mensaje.classList.add('auth-card__mensaje--ok');
    if (tipo === 'error') mensaje.classList.add('auth-card__mensaje--error');
  };

  // ── Banner de estado ──────────────────────────────────
  const renderBanner = (perfil) => {
    if (perfil.vetado) {
      banner.hidden = false;
      banner.className = 'aviso aviso--rojo';
      bannerIcono.textContent = '🚫';
      bannerTitulo.textContent = 'Cuenta vetada';
      bannerTexto.textContent = perfil.motivoVeto
        ? `Motivo: ${perfil.motivoVeto}. Contacta a soporte técnico.`
        : 'Tu cuenta ha sido vetada. Contacta a soporte técnico.';
      return;
    }
    if (perfil.estado === 'VERIFICADO') {
      if (perfil.notificacionReciente?.tipo === 'VERIFICACION_APROBADA') {
        banner.hidden = false;
        banner.className = 'aviso aviso--verde';
        bannerIcono.textContent = '✓';
        bannerTitulo.textContent = 'Ahora eres organizador verificado';
        bannerTexto.textContent = perfil.notificacionReciente.mensaje;
      } else {
        banner.hidden = true;
      }
      return;
    }
    if (perfil.estado === 'EN_REVISION') {
      banner.hidden = false;
      banner.className = 'aviso';
      bannerIcono.textContent = '🕒';
      bannerTitulo.textContent = 'Tu cuenta fue reactivada y está en revisión';
      bannerTexto.textContent = perfil.notificacionReciente?.mensaje ||
        `Un administrador revisará tu cuenta en las próximas 24 horas. Motivo: ${perfil.motivoReactivacion || 'revisión administrativa'}${perfil.detalleReactivacion ? ` Nota: ${perfil.detalleReactivacion}` : ''}`;
      return;
    }
    if (perfil.estado === 'RECHAZADO') {
      banner.hidden = false;
      banner.className = 'aviso aviso--rojo';
      bannerIcono.textContent = '⚠️';
      bannerTitulo.textContent = 'Solicitud denegada';
      bannerTexto.textContent = `${perfil.motivoEstado || 'Tu solicitud de verificación fue rechazada.'} Puedes corregir tus datos y guardar los cambios para volver a postularte.`;
      return;
    }
    if (perfil.estado === 'SUSPENDIDO') {
      banner.hidden = false;
      banner.className = 'aviso aviso--rojo';
      bannerIcono.textContent = '⚠️';
      bannerTitulo.textContent = 'Cuenta suspendida';
      bannerTexto.textContent = perfil.motivoEstado
        ? `${perfil.motivoEstado} Contacta a soporte técnico si necesitas más información.`
        : 'Tu cuenta ha sido suspendida. Contacta a soporte técnico.';
      return;
    }
    // PENDIENTE
    banner.hidden = false;
    banner.className = 'aviso';
    bannerIcono.textContent = '⚠️';
    bannerTitulo.textContent = 'Cuenta en proceso de verificación';
    bannerTexto.textContent = 'Tu cuenta está siendo verificada para asegurar la validez de los eventos culturales presentados. Esto puede tomar hasta 24 horas.';
  };

  // ── Rellenar formulario ───────────────────────────────
  const rellenarForm = (perfil) => {
    form.nombreEntidad.value = perfil.nombreEntidad || '';
    form.tipoEntidad.value = perfil.tipoEntidad || '';
    form.nit.value = perfil.nit || '';
    form.anioFundacion.value = perfil.anioFundacion || '';
    form.descripcion.value = perfil.descripcion || '';
    form.telefono.value = perfil.telefono || '';
    form.direccion.value = perfil.direccion || '';
    form.ciudadBaseId.value = perfil.ciudadBase?.id || '';

    // Documento: solo mostrar placeholder con la máscara si ya tiene.
    if (perfil.tieneDocumento && perfil.documentoIdentidadEnmascarado) {
      form.documentoIdentidad.placeholder = `${perfil.documentoIdentidadEnmascarado} (ingresa 7 a 10 dígitos para cambiarlo)`;
      form.documentoIdentidad.required = false;
    } else {
      form.documentoIdentidad.placeholder = 'Solo dígitos (7 a 10)';
      form.documentoIdentidad.required = true;
    }

    // Redes sociales
    const redes = perfil.redesSociales || {};
    document.querySelectorAll('[data-red]').forEach((input) => {
      const key = input.dataset.red;
      input.value = redes[key] || '';
    });

    // Avatar
    if (perfil.avatarUrl) {
      avatarPreview.innerHTML = `<img src="${esc(perfil.avatarUrl)}" alt="Avatar">`;
    } else {
      avatarPreview.innerHTML = `<span data-avatar-inicial>${esc(iniciales(perfil.nombreEntidad))}</span>`;
    }

    // Resumen lateral
    resumenNombre.textContent = perfil.nombreEntidad || '—';
    resumenCiudad.textContent = perfil.ciudadBase?.nombre
      ? `${perfil.ciudadBase.nombre}, Cauca`
      : 'Sin ciudad base';
    resumenRedes.innerHTML = Object.entries(redes)
      .filter(([, v]) => v)
      .map(([k, v]) => `<li><strong>${esc(REDES_LABEL[k] || k)}:</strong><br>${esc(v)}</li>`)
      .join('');

    // Sidebar
    sidebarNombre.textContent = perfil.nombreEntidad || 'Organizador';
    sidebarInicial.textContent = iniciales(perfil.nombreEntidad);

    // Si está vetado → desactivar form
    if (perfil.vetado) {
      form.querySelectorAll('input, select, textarea, button').forEach((el) => { el.disabled = true; });
      avatarBtn.disabled = true;
    }

    // Si ya tiene documento → cambiar la ayuda
    if (perfil.tieneDocumento) {
      docAyuda.textContent = `Ya guardado: ${perfil.documentoIdentidadEnmascarado}. Déjalo vacío para mantenerlo; si quieres cambiarlo, ingresa el documento completo de 7 a 10 dígitos.`;
    }
  };

  // ── Cargar ciudades ───────────────────────────────────
  const cargarCiudades = async () => {
    try {
      const resp = await AC_API.listarCiudades();
      const ciudades = Array.isArray(resp) ? resp : (resp?.value || resp?.data || []);
      const select = document.getElementById('ciudadBaseId');
      ciudades
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .forEach((c) => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.nombre;
          select.appendChild(opt);
        });
    } catch (error) {
      console.warn('No se pudieron cargar ciudades:', error);
    }
  };

  // ── Cargar perfil ─────────────────────────────────────
  const cargarPerfil = async () => {
    try {
      perfilActual = await AC_API.perfilOrganizador
        ? await AC_API.perfilOrganizador()
        : await fetch(`${window.AC_CONFIG.API_BASE_URL}/organizadores/perfil`, {
            headers: { Authorization: `Bearer ${AC_API.getToken()}` }
          }).then((r) => r.json());

      renderBanner(perfilActual);
      rellenarForm(perfilActual);
    } catch (error) {
      mostrarMensaje(`No se pudo cargar el perfil: ${error.message}`, 'error');
    }
  };

  // ── Subir avatar ──────────────────────────────────────
  avatarBtn.addEventListener('click', () => avatarInput.click());

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    // Preview local inmediato
    const reader = new FileReader();
    reader.onload = (e) => {
      avatarPreview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
    };
    reader.readAsDataURL(file);

    avatarBtn.disabled = true;
    avatarBtn.textContent = 'Subiendo…';
    mostrarMensaje('Subiendo imagen…', null);

    try {
      const { url } = await AC_API.subirImagen(file, 'avatares');
      await AC_API.actualizarPerfilOrganizador({ avatarUrl: url });
      mostrarMensaje('✓ Foto actualizada', 'ok');
      avatarBtn.textContent = 'Cambiar foto';
    } catch (error) {
      mostrarMensaje(`No se pudo subir la foto: ${error.message}`, 'error');
      avatarBtn.textContent = 'Cambiar foto';
    } finally {
      avatarBtn.disabled = false;
      avatarInput.value = '';
    }
  });

  // ── Guardar ───────────────────────────────────────────
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const payload = {
      nombreEntidad: form.nombreEntidad.value.trim(),
      tipoEntidad: form.tipoEntidad.value || null,
      nit: form.nit.value.trim() || null,
      anioFundacion: form.anioFundacion.value ? parseInt(form.anioFundacion.value, 10) : null,
      descripcion: form.descripcion.value.trim() || null,
      telefono: form.telefono.value.trim() || null,
      direccion: form.direccion.value.trim() || null,
      ciudadBaseId: form.ciudadBaseId.value ? parseInt(form.ciudadBaseId.value, 10) : null,
      redesSociales: {}
    };

    // Documento: solo si escribió algo
    const doc = form.documentoIdentidad.value.trim();
    if (doc) {
      if (!/^\d{7,10}$/.test(doc)) {
        mostrarMensaje('El documento debe tener entre 7 y 10 dígitos', 'error');
        return;
      }
      payload.documentoIdentidad = doc;
    }

    // Redes: solo las que tienen valor
    document.querySelectorAll('[data-red]').forEach((input) => {
      const v = input.value.trim();
      if (v) payload.redesSociales[input.dataset.red] = v;
    });
    if (Object.keys(payload.redesSociales).length === 0) {
      payload.redesSociales = null;
    }

    botonGuardar.disabled = true;
    mostrarMensaje('Guardando…', null);

    try {
      const resp = await AC_API.actualizarPerfilOrganizador(payload);
      // Actualizar perfil en memoria sin re-fetch
      if (resp?.organizador) {
        perfilActual = { ...perfilActual, ...resp.organizador };
      }
      renderBanner(perfilActual);
      rellenarForm(perfilActual);
      mostrarMensaje('✓ Cambios guardados', 'ok');
    } catch (error) {
      mostrarMensaje(`No se pudo guardar: ${error.message}`, 'error');
    } finally {
      botonGuardar.disabled = false;
    }
  });

  // ── Arrancar ──────────────────────────────────────────
  (async () => {
    await cargarCiudades();
    await cargarPerfil();
  })();
})();