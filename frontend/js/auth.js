/**
 * Agenda Caucana — Auth.
 *
 * Responsabilidades:
 *  - Guard de páginas protegidas (acProtegerPagina).
 *  - Login de organizador/admin (formulario [data-form-login]).
 *  - Registro de organizador ([data-form-registro-organizador]).
 *  - Logout centralizado (acLogout + listener global [data-logout]).
 *
 * Cualquier página que incluya este script obtiene el listener global
 * de logout automáticamente. No hace falta enganchar el botón a mano.
 */

/**
 * Detecta la ruta relativa al login según dónde esté montada la página.
 *  - /popayan-go/... → login.html (el login propio de Popayán GO)
 *  - /admin|organizador|jugador/... → ../login.html
 *  - raíz → login.html
 */
function acRutaLogin() {
  const path = window.location.pathname;
  if (/\/popayan-go\//.test(path)) return 'login.html';
  if (/\/(admin|organizador|jugador)\//.test(path)) return '../login.html';
  return 'login.html';
}

function acDestinoSiguiente() {
  const destino = new URLSearchParams(window.location.search).get('next');
  if (
    !destino ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_\-\/\.]*$/.test(destino) ||
    destino.includes('..')
  ) {
    return null;
  }
  return destino;
}

/**
 * Protege páginas de admin/organizador: si no hay token guardado, redirige
 * al login. rutaLogin es RELATIVA a la página que llama; si no se pasa,
 * se detecta automáticamente.
 */
function acProtegerPagina(rutaLogin) {
  const token = AC_API.getToken();
  if (!token) {
    window.location.href = rutaLogin || acRutaLogin();
    return false;
  }
  return true;
}

/**
 * Cierra sesión de forma completa:
 *  1. Revoca el refresh token en el backend (AC_API.cerrarSesion).
 *  2. Limpia access token + refresh token local.
 *  3. Redirige al login (o a la ruta que se le pase).
 *
 * Nota: si el backend falla, igual limpiamos y redirigimos. La sesión
 * local queda cerrada siempre.
 */
async function acLogout(rutaDestino) {
  try {
    await AC_API.cerrarSesion();
  } catch (error) {
    console.warn('No se pudo revocar el refresh token en el backend:', error);
  }
  window.location.href = rutaDestino || acRutaLogin();
}

// ── Listener global de logout ────────────────────────────
// Cualquier elemento con [data-logout] dispara acLogout().
// Opcionalmente puede llevar [data-logout-ruta="..."] para forzar destino.
document.addEventListener('click', (evento) => {
  const disparador = evento.target.closest('[data-logout]');
  if (!disparador) return;
  evento.preventDefault();
  const rutaCustom = disparador.getAttribute('data-logout-ruta');
  acLogout(rutaCustom || undefined);
});

// ── Formulario de login (organizador / admin) ────────────
(function () {
  const formLogin = document.querySelector('[data-form-login]');
  if (formLogin) {
    const mensaje = document.querySelector('[data-login-mensaje]');
    formLogin.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const datos = new FormData(formLogin);
      const boton = formLogin.querySelector('button[type="submit"]');
      boton.disabled = true;
      mensaje.className = 'auth-card__mensaje';
      mensaje.textContent = 'Ingresando...';
      try {
        const respuesta = await AC_API.login(datos.get('email'), datos.get('password'));
        const token = respuesta.tokens?.accessToken || respuesta.token || respuesta.accessToken || respuesta.jwt;
        if (!token) throw new Error('El servidor no devolvió un token de sesión.');
        AC_API.setToken(token);
        if (respuesta.tokens?.refreshToken) {
          localStorage.setItem('agendaCaucanaRefreshToken', respuesta.tokens.refreshToken);
        }

        // Redirección por rol. Antes ignoraba JUGADOR.
        const rol = respuesta.usuario?.rol;
        let destino;
        switch (rol) {
          case 'ADMIN':        destino = 'admin/resumen.html';            break;
          case 'ORGANIZADOR':  destino = 'organizador/mis-eventos.html';  break;
          case 'JUGADOR':      destino = 'popayan-go/perfil.html';        break;
          default:             destino = 'index.html';
        }
        destino = acDestinoSiguiente() || destino;
        window.location.href = destino;
      } catch (error) {
        mensaje.textContent = `No se pudo iniciar sesión: ${error.message}`;
        mensaje.classList.add('auth-card__mensaje--error');
        boton.disabled = false;
      }
    });
  }

  // ── Formulario de registro de organizador ──────────────
  const formRegistro = document.querySelector('[data-form-registro-organizador]');
  if (formRegistro) {
    const mensaje = document.querySelector('[data-registro-mensaje]');
    formRegistro.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const datos = new FormData(formRegistro);
      const boton = formRegistro.querySelector('button[type="submit"]');
      boton.disabled = true;
      mensaje.className = 'auth-card__mensaje';
      mensaje.textContent = 'Creando tu cuenta...';
      try {
        const payload = {
          nombreEntidad: datos.get('nombreOrganizacion'),
          nombre:        datos.get('nombreContacto'),
          email:         datos.get('email'),
          telefono:      datos.get('telefono'),
          password:      datos.get('password')
        };
        const respuesta = await AC_API.registrarOrganizador(payload);
        const token = respuesta.token || respuesta.accessToken || respuesta.jwt;
        if (token) AC_API.setToken(token);
        mensaje.textContent = '✓ Cuenta creada. Tu solicitud queda en espera de verificación por un administrador.';
        mensaje.classList.add('auth-card__mensaje--ok');
        formRegistro.reset();
        const destinoSiguiente = acDestinoSiguiente();
        setTimeout(() => {
          if (destinoSiguiente) {
            window.location.href = token
              ? `../${destinoSiguiente}`
              : `../login.html?next=${encodeURIComponent(destinoSiguiente)}`;
            return;
          }
          window.location.href = token ? '../organizador/perfil.html' : '../login.html';
        }, 1800);
      } catch (error) {
        mensaje.textContent = `No se pudo crear la cuenta: ${error.message}`;
        mensaje.classList.add('auth-card__mensaje--error');
        boton.disabled = false;
      }
    });
  }
})();