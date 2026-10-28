/**
 * jugador-recuperar.js — Recuperación de cuenta de jugador en dos pasos.
 *
 * Reglas de seguridad aplicadas:
 *  - El resetToken vive SOLO en una variable de este módulo. Nunca toca
 *    localStorage ni sessionStorage.
 *  - La URL no cambia entre pasos: no hay nada que filtrar por historial
 *    ni por referrer, porque el token nunca sale del JS.
 *  - Si el usuario recarga la página estando en el paso 2, la variable se
 *    pierde junto con todo el estado del módulo, así que el script arranca
 *    de nuevo mostrando el paso 1 automáticamente — es el comportamiento
 *    correcto sin necesidad de detectarlo a mano.
 */
(function () {
  'use strict';

  var LARGO_MINIMO = 8;

  /* El token vive aquí y en ningún otro lado. */
  var resetToken = null;

  var pasoIdentifica = document.getElementById('pasoIdentifica');
  var pasoPassword = document.getElementById('pasoPassword');

  var formIdentifica = document.getElementById('formIdentifica');
  var campoUsername = document.getElementById('campoUsername');
  var campoCodigo = document.getElementById('campoCodigo');
  var errorUsername = document.getElementById('errorUsername');
  var errorCodigo = document.getElementById('errorCodigo');
  var botonValidar = document.getElementById('botonValidar');
  var mensajePaso1 = document.getElementById('mensajePaso1');

  var formPassword = document.getElementById('formPassword');
  var campoPassword = document.getElementById('campoPassword');
  var campoConfirmar = document.getElementById('campoConfirmar');
  var errorPassword = document.getElementById('errorPassword');
  var errorConfirmar = document.getElementById('errorConfirmar');
  var botonGuardar = document.getElementById('botonGuardar');
  var mensajePaso2 = document.getElementById('mensajePaso2');
  var bloqueFortaleza = document.getElementById('fortaleza');
  var textoFortaleza = document.getElementById('fortalezaTexto');
  var segmentosFortaleza = bloqueFortaleza.querySelectorAll('.fortaleza__segmento');

  var enviandoPaso1 = false;
  var enviandoPaso2 = false;

  /* ── Utilidades compartidas ───────────────────────────────── */

  function textoI18n(clave, respaldo) {
    if (window.AC_I18N && typeof window.AC_I18N.obtener === 'function') {
      var valor = window.AC_I18N.obtener(clave);
      if (valor && valor !== clave) return valor;
    }
    return respaldo;
  }

  function mostrarMensaje(elemento, texto, tipo) {
    elemento.textContent = texto;
    elemento.classList.remove('auth-card__mensaje--error', 'auth-card__mensaje--ok');
    if (tipo) elemento.classList.add('auth-card__mensaje--' + tipo);
    elemento.hidden = false;
  }

  function limpiarMensaje(elemento) {
    elemento.hidden = true;
    elemento.textContent = '';
  }

  function marcarError(campo, contenedorError, texto) {
    contenedorError.textContent = texto;
    campo.setAttribute('aria-invalid', 'true');
  }

  function limpiarError(campo, contenedorError) {
    contenedorError.textContent = '';
    campo.removeAttribute('aria-invalid');
  }

  function activarCarga(boton, activa) {
    boton.disabled = activa;
    boton.setAttribute('aria-busy', activa ? 'true' : 'false');
    boton.querySelector('.boton__spinner').hidden = !activa;
  }

  function esErrorDeLimite(error) {
    return !!(error && error.status === 429);
  }

  /* ── Máscara del código XXXX-XXXX ─────────────────────────── */

  function formatearCodigo(valor) {
    var limpio = valor.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (limpio.length > 4) {
      return limpio.slice(0, 4) + '-' + limpio.slice(4);
    }
    return limpio;
  }

  campoCodigo.addEventListener('input', function () {
    campoCodigo.value = formatearCodigo(campoCodigo.value);
    limpiarError(campoCodigo, errorCodigo);
  });

  campoUsername.addEventListener('input', function () {
    limpiarError(campoUsername, errorUsername);
  });

  /* ── Paso 1: validar username + código ────────────────────── */

  function validarPaso1() {
    var username = campoUsername.value.trim();
    var codigo = campoCodigo.value.trim();
    var valido = true;

    limpiarError(campoUsername, errorUsername);
    limpiarError(campoCodigo, errorCodigo);

    if (!username) {
      marcarError(campoUsername, errorUsername, textoI18n('jugadorRecuperar.error_username_vacio', 'Escribe tu usuario.'));
      valido = false;
    }

    if (!codigo) {
      marcarError(campoCodigo, errorCodigo, textoI18n('jugadorRecuperar.error_codigo_vacio', 'Escribe tu código de recuperación.'));
      valido = false;
    } else if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) {
      marcarError(campoCodigo, errorCodigo, textoI18n('jugadorRecuperar.error_codigo_formato', 'El código debe tener el formato XXXX-XXXX.'));
      valido = false;
    }

    return valido ? { username: username, codigo: codigo } : null;
  }

  function irAPaso2() {
    pasoIdentifica.hidden = true;
    pasoPassword.hidden = false;
    campoPassword.focus();
  }

  function enviarPaso1() {
    if (enviandoPaso1) return;
    limpiarMensaje(mensajePaso1);

    var datos = validarPaso1();
    if (!datos) return;

    enviandoPaso1 = true;
    activarCarga(botonValidar, true);

    window.AC_API.solicitarResetJugador(datos.username, datos.codigo)
      .then(function (respuesta) {
        enviandoPaso1 = false;
        activarCarga(botonValidar, false);

        if (!respuesta || !respuesta.resetToken) {
          mostrarMensaje(
            mensajePaso1,
            textoI18n('jugadorRecuperar.error_conexion', 'No se pudo conectar con el servidor. Revisa tu conexión e intenta otra vez.'),
            'error'
          );
          return;
        }

        resetToken = respuesta.resetToken;
        irAPaso2();
      })
      .catch(function (error) {
        enviandoPaso1 = false;
        activarCarga(botonValidar, false);

        if (esErrorDeLimite(error)) {
          mostrarMensaje(
            mensajePaso1,
            textoI18n('jugadorRecuperar.error_limite', 'Ya hiciste varias solicitudes. Intenta de nuevo en una hora.'),
            'error'
          );
          return;
        }

        var mensaje = error && error.message ? error.message : '';
        marcarError(campoCodigo, errorCodigo, mensaje || textoI18n('jugadorRecuperar.error_conexion', 'No se pudo conectar con el servidor. Revisa tu conexión e intenta otra vez.'));
      });
  }

  formIdentifica.addEventListener('submit', function (evento) {
    evento.preventDefault();
    enviarPaso1();
  });

  /* ── Medidor de fortaleza (mismo algoritmo que reset.js) ──── */

  function calcularFortaleza(valor) {
    if (!valor) return 0;

    var puntos = 0;
    if (valor.length >= LARGO_MINIMO) puntos++;
    if (valor.length >= 12) puntos++;
    if (/[a-z]/.test(valor) && /[A-Z]/.test(valor)) puntos++;
    if (/\d/.test(valor)) puntos++;
    if (/[^A-Za-z0-9]/.test(valor)) puntos++;

    if (valor.length < LARGO_MINIMO) return 1;

    if (puntos <= 2) return 1;
    if (puntos === 3) return 2;
    if (puntos === 4) return 3;
    return 4;
  }

  function etiquetaFortaleza(nivel) {
    switch (nivel) {
      case 1: return textoI18n('jugadorRecuperar.fortaleza_debil', 'Débil');
      case 2: return textoI18n('jugadorRecuperar.fortaleza_media', 'Aceptable');
      case 3: return textoI18n('jugadorRecuperar.fortaleza_buena', 'Buena');
      case 4: return textoI18n('jugadorRecuperar.fortaleza_fuerte', 'Fuerte');
      default: return '';
    }
  }

  function pintarFortaleza(valor) {
    var nivel = calcularFortaleza(valor);
    bloqueFortaleza.hidden = !valor;

    for (var i = 0; i < segmentosFortaleza.length; i++) {
      var posicion = i + 1;
      segmentosFortaleza[i].className = 'fortaleza__segmento';
      if (posicion <= nivel) {
        segmentosFortaleza[i].classList.add('fortaleza__segmento--nivel-' + nivel);
      }
    }

    textoFortaleza.textContent = etiquetaFortaleza(nivel);
  }

  campoPassword.addEventListener('input', function () {
    pintarFortaleza(campoPassword.value);
    limpiarError(campoPassword, errorPassword);
  });

  campoConfirmar.addEventListener('input', function () {
    limpiarError(campoConfirmar, errorConfirmar);
  });

  /* ── Paso 2: nueva contraseña ──────────────────────────────── */

  function validarPaso2() {
    var password = campoPassword.value;
    var confirmar = campoConfirmar.value;
    var valido = true;

    limpiarError(campoPassword, errorPassword);
    limpiarError(campoConfirmar, errorConfirmar);

    if (!password) {
      marcarError(campoPassword, errorPassword, textoI18n('jugadorRecuperar.error_password_vacia', 'Escribe tu nueva contraseña.'));
      valido = false;
    } else if (password.length < LARGO_MINIMO) {
      marcarError(campoPassword, errorPassword, textoI18n('jugadorRecuperar.error_password_corta', 'Debe tener al menos 8 caracteres.'));
      valido = false;
    }

    if (!confirmar) {
      marcarError(campoConfirmar, errorConfirmar, textoI18n('jugadorRecuperar.error_confirmar_vacia', 'Repite la contraseña para confirmarla.'));
      valido = false;
    } else if (password !== confirmar) {
      marcarError(campoConfirmar, errorConfirmar, textoI18n('jugadorRecuperar.error_no_coinciden', 'Las dos contraseñas no coinciden.'));
      valido = false;
    }

    if (!valido) {
      var primerError = pasoPassword.querySelector('[aria-invalid="true"]');
      if (primerError) primerError.focus();
    }

    return valido;
  }

  function enviarPaso2() {
    if (enviandoPaso2) return;
    limpiarMensaje(mensajePaso2);

    if (!resetToken) {
      mostrarMensaje(mensajePaso2, textoI18n('jugadorRecuperar.error_expirado', 'Por seguridad, este paso expira si recargas la página. Empieza de nuevo.'), 'error');
      return;
    }

    if (!validarPaso2()) return;

    enviandoPaso2 = true;
    activarCarga(botonGuardar, true);

    window.AC_API.confirmarResetJugador(resetToken, campoPassword.value)
      .then(function (respuesta) {
        enviandoPaso2 = false;
        activarCarga(botonGuardar, false);

        resetToken = null;
        formPassword.hidden = true;
        bloqueFortaleza.hidden = true;

        var texto = (respuesta && respuesta.mensaje)
          ? respuesta.mensaje
          : textoI18n('jugadorRecuperar.exito', 'Contraseña actualizada. Ya puedes iniciar sesión.');
        mostrarMensaje(mensajePaso2, texto, 'ok');
      })
      .catch(function (error) {
        enviandoPaso2 = false;
        activarCarga(botonGuardar, false);

        var mensaje = error && error.message ? error.message : '';
        mostrarMensaje(mensajePaso2, mensaje || textoI18n('jugadorRecuperar.error_conexion', 'No se pudo conectar con el servidor. Revisa tu conexión e intenta otra vez.'), 'error');
      });
  }

  formPassword.addEventListener('submit', function (evento) {
    evento.preventDefault();
    enviarPaso2();
  });

  if (!resetToken) {
    pasoIdentifica.hidden = false;
    pasoPassword.hidden = true;
  }
})();