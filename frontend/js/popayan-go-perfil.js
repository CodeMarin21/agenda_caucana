/**
 * Popayán GO — Editar perfil.
 * El selector de avatar predeterminado ya lo maneja popayan-go-auth.js
 * (se reutiliza el mismo bloque de markup). Este archivo se encarga de:
 *  - Precargar los datos actuales del perfil.
 *  - Guardar el PATCH al backend.
 *  - El toggle de privacidad (todavía sin endpoint — ver aviso en el HTML).
 *
 * El logout NO se maneja aquí: lo centraliza auth.js vía [data-logout].
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('login.html')) return;

  const avatarPreview = document.querySelector('[data-editar-avatar]');
  const bioInput = document.querySelector('[data-editar-bio-input]');

  AC_API.perfilJugador().then((perfil) => {
    if (bioInput) bioInput.value = perfil.descripcion || '';
    if (avatarPreview && perfil.avatarUrl) {
      avatarPreview.textContent = '';
      const img = document.createElement('img');
      img.src = perfil.avatarUrl;
      avatarPreview.appendChild(img);
    }
  }).catch((error) => console.error('No se pudo precargar el perfil:', error));

  const form = document.querySelector('[data-form-editar-perfil]');
  if (form) {
    const mensaje = document.querySelector('[data-editar-perfil-mensaje]');
    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const boton = form.querySelector('button[type="submit"]');
      boton.disabled = true;
      mensaje.className = 'auth-card__mensaje';
      mensaje.textContent = 'Guardando...';
      try {
        const avatarInput = document.querySelector('input[name="avatarPredeterminado"]');
        await AC_API.actualizarPerfilJugador({
          descripcion: bioInput.value.trim(),
          // Nota: aquí solo mandamos el emoji del avatar predeterminado como
          // placeholder de avatarUrl hasta que exista un endpoint real de
          // subida de imágenes (ver nota en popayan-go-auth.js).
          avatarUrl: avatarInput ? avatarInput.value : undefined
        });
        mensaje.textContent = '✓ Perfil actualizado';
        mensaje.classList.add('auth-card__mensaje--ok');
      } catch (error) {
        mensaje.textContent = `No se pudo guardar: ${error.message}`;
        mensaje.classList.add('auth-card__mensaje--error');
      } finally {
        boton.disabled = false;
      }
    });
  }

  // Toggle de privacidad — SOLO INTERFAZ, no hay endpoint todavía (ver aviso en el HTML)
  const togglePrivacidad = document.querySelector('[data-toggle-privacidad]');
  if (togglePrivacidad) {
    togglePrivacidad.addEventListener('change', () => {
      console.warn('Cambio de privacidad todavía no se envía al backend — falta el endpoint.');
    });
  }
})();