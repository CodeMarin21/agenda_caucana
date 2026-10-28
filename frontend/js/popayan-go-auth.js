/**
 * Popayán GO — Registro y login de jugador.
 * Sigue el contrato: POST /api/auth/registro { username, password, descripcion, rol: 'JUGADOR' }
 * y POST /api/auth/login { username, password }.
 */
(function () {

  function texto(clave, respaldo) {
    if (window.AC_I18N && typeof window.AC_I18N.obtener === 'function') {
      const valor = window.AC_I18N.obtener(clave);
      if (valor && valor !== clave) return valor;
    }
    return respaldo;
  }

  // -------- Selector de avatar (predeterminado) --------
  const selector = document.querySelector('[data-selector-avatar]');
  if (selector) {
    const inputOculto = document.querySelector('input[name="avatarPredeterminado"]');
    selector.querySelectorAll('.avatar-opcion').forEach((btn) => {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.avatar-opcion').forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        inputOculto.value = btn.dataset.avatar;
      });
    });
  }

  /**
   * Modal de códigos de recuperación — se muestra una sola vez, justo
   * después de un registro exitoso de jugador.
   *
   * Seguridad: `codigos` solo existe en las variables de esta función
   * mientras el modal está abierto. Nunca se escribe en localStorage ni
   * sessionStorage. Si el usuario cierra la pestaña sin pulsar "Continuar",
   * los códigos se pierden — es la decisión de negocio, no un descuido.
   */
  function abrirModalCodigos(codigos, advertencia, alTerminar) {
    const elementoActivoPrevio = document.activeElement;
    let haInteractuado = false;

    const overlay = document.createElement('div');
    overlay.className = 'modal-codigos__overlay';

    const dialogo = document.createElement('div');
    dialogo.className = 'modal-codigos';
    dialogo.setAttribute('role', 'dialog');
    dialogo.setAttribute('aria-modal', 'true');
    dialogo.setAttribute('aria-labelledby', 'modalCodigosTitulo');

    dialogo.innerHTML = `
      <h2 id="modalCodigosTitulo" class="fuente-titulos" data-i18n="jugadorRegistro.titulo_codigos">${texto('jugadorRegistro.titulo_codigos', 'Guarda estos códigos')}</h2>
      <p class="modal-codigos__advertencia" role="alert" data-i18n="jugadorRegistro.advertencia_codigos">${advertencia || texto('jugadorRegistro.advertencia_codigos', 'Son la ÚNICA forma de recuperar tu cuenta si olvidas tu contraseña. NO se volverán a mostrar.')}</p>

      <ul class="modal-codigos__grid"></ul>

      <div class="modal-codigos__acciones">
        <button type="button" class="boton boton-secundario boton-sm" data-accion="copiar-todos">
          <span data-i18n="jugadorRegistro.boton_copiar_todos">${texto('jugadorRegistro.boton_copiar_todos', 'Copiar todos')}</span>
        </button>
        <button type="button" class="boton boton-secundario boton-sm" data-accion="descargar">
          <span data-i18n="jugadorRegistro.boton_descargar_txt">${texto('jugadorRegistro.boton_descargar_txt', 'Descargar .txt')}</span>
        </button>
      </div>

      <label class="modal-codigos__checkbox">
        <input type="checkbox" data-checkbox-guardados>
        <span data-i18n="jugadorRegistro.checkbox_guardados">${texto('jugadorRegistro.checkbox_guardados', 'He guardado mis códigos en un lugar seguro')}</span>
      </label>

      <button type="button" class="boton boton-go boton-bloque" data-accion="continuar" disabled>
        <span data-i18n="jugadorRegistro.boton_continuar">${texto('jugadorRegistro.boton_continuar', 'Continuar')}</span>
      </button>
    `;

    const grid = dialogo.querySelector('.modal-codigos__grid');
    const textoCopiar = texto('jugadorRegistro.boton_copiar', 'Copiar');
    const textoCopiado = texto('jugadorRegistro.boton_copiado', 'Copiado ✓');

    codigos.forEach((codigo, indice) => {
      const item = document.createElement('li');
      item.className = 'modal-codigos__item';
      item.innerHTML = `
        <span class="modal-codigos__valor">${codigo}</span>
        <button type="button" class="boton-copiar" data-accion="copiar-uno" data-codigo="${codigo}" aria-label="${texto('jugadorRegistro.boton_copiar', 'Copiar')} código ${indice + 1}">
          <span>${textoCopiar}</span>
        </button>
      `;
      grid.appendChild(item);
    });

    overlay.appendChild(dialogo);
    document.body.appendChild(overlay);
    document.body.classList.add('modal-abierto');

    const botonContinuar = dialogo.querySelector('[data-accion="continuar"]');
    const checkboxGuardados = dialogo.querySelector('[data-checkbox-guardados]');

    function actualizarBotonContinuar() {
      botonContinuar.disabled = !(haInteractuado && checkboxGuardados.checked);
    }

    function marcarInteraccion() {
      haInteractuado = true;
      actualizarBotonContinuar();
    }

    function copiarTexto(valor) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(valor);
      }
      // Respaldo para navegadores sin Clipboard API (contexto no seguro).
      const areaTemporal = document.createElement('textarea');
      areaTemporal.value = valor;
      areaTemporal.style.position = 'fixed';
      areaTemporal.style.opacity = '0';
      document.body.appendChild(areaTemporal);
      areaTemporal.select();
      try {
        document.execCommand('copy');
      } finally {
        document.body.removeChild(areaTemporal);
      }
      return Promise.resolve();
    }

    dialogo.addEventListener('click', (evento) => {
      const boton = evento.target.closest('[data-accion]');
      if (!boton) return;
      const accion = boton.dataset.accion;

      if (accion === 'copiar-uno') {
        copiarTexto(boton.dataset.codigo).then(() => {
          const etiqueta = boton.querySelector('span');
          const original = etiqueta.textContent;
          etiqueta.textContent = textoCopiado;
          clearTimeout(boton._temporizador);
          boton._temporizador = setTimeout(() => {
            etiqueta.textContent = original;
          }, 2000);
          marcarInteraccion();
        });
      }

      if (accion === 'copiar-todos') {
        copiarTexto(codigos.join('\n')).then(marcarInteraccion);
      }

      if (accion === 'descargar') {
        const nombreArchivo = texto('jugadorRegistro.archivo_codigos', 'agenda-caucana-codigos-recuperacion.txt');
        const blob = new Blob([codigos.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombreArchivo;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);
        URL.revokeObjectURL(url);
        marcarInteraccion();
      }

      if (accion === 'continuar' && !botonContinuar.disabled) {
        cerrar();
      }
    });

    checkboxGuardados.addEventListener('change', actualizarBotonContinuar);

    /* ── Foco atrapado + ESC deshabilitado ────────────────────── */

    function elementosFocalizables() {
      return Array.from(dialogo.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])'))
        .filter((el) => !el.disabled && el.offsetParent !== null);
    }

    function manejarTeclado(evento) {
      if (evento.key === 'Escape') {
        // Deshabilitado a propósito: el usuario no puede cerrar el modal
        // sin marcar el checkbox — es la única copia de estos códigos.
        evento.preventDefault();
        return;
      }

      if (evento.key !== 'Tab') return;

      const focalizables = elementosFocalizables();
      if (focalizables.length === 0) return;

      const primero = focalizables[0];
      const ultimo = focalizables[focalizables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', manejarTeclado, true);

    function cerrar() {
      document.removeEventListener('keydown', manejarTeclado, true);
      document.body.classList.remove('modal-abierto');
      overlay.remove();
      if (elementoActivoPrevio && typeof elementoActivoPrevio.focus === 'function') {
        elementoActivoPrevio.focus();
      }
      alTerminar();
    }

    const primerFocalizable = elementosFocalizables()[0];
    if (primerFocalizable) primerFocalizable.focus();
  }

  // -------- Registro --------
  const formRegistro = document.querySelector('[data-form-registro-jugador]');
  if (formRegistro) {
    const mensaje = document.querySelector('[data-registro-jugador-mensaje]');
    formRegistro.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const datos = new FormData(formRegistro);
      const boton = formRegistro.querySelector('button[type="submit"]');

      const archivo = datos.get('avatarArchivo');
      if (archivo && archivo.size > 0) {
        console.warn('Subida de avatar personalizado pendiente de endpoint — se usa el avatar predeterminado por ahora.');
      }

      boton.disabled = true;
      mensaje.className = 'auth-card__mensaje';
      mensaje.textContent = 'Creando tu pasaporte...';

      try {
        const payload = {
          username: datos.get('username').trim(),
          password: datos.get('password'),
          descripcion: datos.get('descripcion')?.trim() || undefined,
          rol: 'JUGADOR'
        };
        const respuesta = await AC_API.registrarJugador(payload);

        mensaje.textContent = `✓ ${respuesta.mensaje || 'Cuenta creada'}.`;
        mensaje.classList.add('auth-card__mensaje--ok');
        formRegistro.reset();

        const codigos = Array.isArray(respuesta.recoveryCodes) ? respuesta.recoveryCodes : [];

        if (codigos.length > 0) {
          abrirModalCodigos(codigos, respuesta.advertencia, () => {
            window.location.href = 'login.html';
          });
        } else {
          // Respaldo si el backend alguna vez responde sin códigos: no bloqueamos
          // el registro, solo avisamos en consola y seguimos el flujo normal.
          console.warn('El registro no devolvió recoveryCodes; se omite el modal.');
          setTimeout(() => { window.location.href = 'login.html'; }, 1500);
        }
      } catch (error) {
        mensaje.textContent = `No se pudo crear tu pasaporte: ${error.message}`;
        mensaje.classList.add('auth-card__mensaje--error');
        boton.disabled = false;
      }
    });
  }

  // -------- Login --------
  const formLogin = document.querySelector('[data-form-login-jugador]');
  if (formLogin) {
    const mensaje = document.querySelector('[data-login-jugador-mensaje]');
    formLogin.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const datos = new FormData(formLogin);
      const boton = formLogin.querySelector('button[type="submit"]');
      boton.disabled = true;
      mensaje.className = 'auth-card__mensaje';
      mensaje.textContent = 'Entrando...';

      try {
        const respuesta = await AC_API.loginJugador(datos.get('username'), datos.get('password'));
        const token = respuesta.tokens?.accessToken;
        const refreshToken = respuesta.tokens?.refreshToken;
        if (!token) throw new Error('El servidor no devolvió un token de sesión.');
        AC_API.setToken(token);
        if (refreshToken) localStorage.setItem('agendaCaucanaRefreshToken', refreshToken);
        window.location.href = 'perfil.html';
      } catch (error) {
        mensaje.textContent = `No se pudo iniciar sesión: ${error.message}`;
        mensaje.classList.add('auth-card__mensaje--error');
        boton.disabled = false;
      }
    });
  }
})();