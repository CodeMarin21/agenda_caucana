/**
 * Agenda Caucana — i18n del frontend.
 * Traduce los textos ESTÁTICOS de la interfaz (nav, botones, labels) leyendo
 * /locales/<idioma>.json. El contenido DINÁMICO (eventos, categorías) ya
 * llega traducido desde el backend vía el header Accept-Language que
 * agrega AC_API en cada petición — este archivo no toca eso.
 */
const AC_I18N = (() => {
  let diccionario = {};

  function obtener(clave) {
    return clave.split('.').reduce((acc, parte) => (acc && acc[parte] !== undefined ? acc[parte] : null), diccionario);
  }

  function aplicar() {
    // Importante: si la clave no se encuentra (diccionario vacío, JSON no
    // cargó, falta esa clave), NO se sobreescribe el texto — se deja el
    // texto en español que ya viene escrito en el HTML como valor por
    // defecto. Antes esto pisaba el texto real con la clave cruda
    // ("nav.explorar") cuando /locales/es.json fallaba.
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const clave = el.getAttribute('data-i18n');
      const texto = obtener(clave);
      if (texto === null || texto === undefined) return;
      if (el.hasAttribute('data-i18n-placeholder')) {
        el.setAttribute('placeholder', texto);
      } else {
        el.textContent = texto;
      }
    });
    document.documentElement.lang = AC_API.getLocale();
  }

  async function cargar(locale) {
    try {
      // Ruta RELATIVA (sin "/" inicial): así resuelve bien sin importar si
      // el servidor está montado en la raíz o bajo un subpath — el
      // navegador la resuelve siempre contra la URL de la página actual,
      // que vive en la raíz de frontend/ junto a locales/.
      const respuesta = await fetch(`locales/${locale}.json`);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      diccionario = await respuesta.json();
    } catch (error) {
      console.warn(`No se pudo cargar locales/${locale}.json (${error.message}). Se mantiene el texto en español ya escrito en el HTML.`);
      diccionario = {};
    }
    aplicar();
  }

  function iniciar() {
    const selectores = document.querySelectorAll('[data-selector-idioma]');
    const localeActual = AC_API.getLocale();
    selectores.forEach((sel) => { sel.value = localeActual; });
    cargar(localeActual);

    selectores.forEach((sel) => {
      sel.addEventListener('change', (evento) => {
        const nuevoLocale = evento.target.value;
        AC_API.setLocale(nuevoLocale);
        selectores.forEach((s) => { s.value = nuevoLocale; });
        cargar(nuevoLocale);
        document.dispatchEvent(new CustomEvent('ac:locale-cambiado', { detail: nuevoLocale }));
      });
    });
  }

  return { iniciar, obtener };
})();

document.addEventListener('DOMContentLoaded', AC_I18N.iniciar);
