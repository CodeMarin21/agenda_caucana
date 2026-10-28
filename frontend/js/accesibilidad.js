/**
 * Agenda Caucana — Accesibilidad.
 * 3 herramientas, mutuamente excluyentes con "invertido" (no tiene sentido
 * combinar alto-contraste + invertido): alto contraste, colores invertidos,
 * modo lectura. Se guardan en localStorage y se re-aplican en cada página.
 */
(function () {
  const CLAVE = 'agendaCaucanaAccesibilidad';
  const CLASES = {
    contraste: 'a11y-alto-contraste',
    invertido: 'a11y-invertido',
    lectura: 'a11y-lectura'
  };

  function estadoGuardado() {
    try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; }
    catch { return {}; }
  }

  function aplicarEstado(estado) {
    Object.entries(CLASES).forEach(([clave, clase]) => {
      document.documentElement.classList.toggle(clase, !!estado[clave]);
    });
  }

  function guardarEstado(estado) {
    localStorage.setItem(CLAVE, JSON.stringify(estado));
  }

  // Aplicar de inmediato (antes de que el usuario interactúe) para que no
  // haya parpadeo al cargar la página.
  let estado = estadoGuardado();
  aplicarEstado(estado);

  document.addEventListener('DOMContentLoaded', () => {
    const boton = document.querySelector('[data-a11y-boton]');
    const panel = document.querySelector('[data-a11y-panel]');
    if (!boton || !panel) return;

    boton.addEventListener('click', (evento) => {
      evento.stopPropagation();
      panel.classList.toggle('abierto');
    });
    document.addEventListener('click', () => panel.classList.remove('abierto'));
    panel.addEventListener('click', (evento) => evento.stopPropagation());

    panel.querySelectorAll('[data-a11y-toggle]').forEach((btn) => {
      const clave = btn.dataset.a11yToggle;
      btn.setAttribute('aria-pressed', String(!!estado[clave]));
      btn.addEventListener('click', () => {
        estado = estadoGuardado();
        estado[clave] = !estado[clave];
        guardarEstado(estado);
        aplicarEstado(estado);
        panel.querySelectorAll('[data-a11y-toggle]').forEach((b) => {
          b.setAttribute('aria-pressed', String(!!estado[b.dataset.a11yToggle]));
        });
      });
    });
  });
})();
