/**
 * Popayán GO — Galería de logros.
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('login.html')) return;

  const grid = document.querySelector('[data-logros-grid]');
  const resumen = document.querySelector('[data-logros-resumen]');
  if (!grid) return;

  function logroHtml(logro) {
    return `
      <div class="go-logro ${logro.desbloqueado ? '' : 'bloqueado'}">
        <div class="go-logro__icono">${logro.desbloqueado ? (logro.icono || '🏆') : '🔒'}</div>
        <div class="go-logro__nombre">${logro.nombre}</div>
        <div class="go-logro__meta">${logro.descripcion}</div>
      </div>`;
  }

  AC_API.listarLogrosJugador().then((data) => {
    const logros = data.logros || [];
    const desbloqueados = logros.filter((l) => l.desbloqueado);
    resumen.textContent = `${desbloqueados.length} de ${logros.length} desbloqueados`;
    grid.innerHTML = logros.map(logroHtml).join('') || '<p style="color:var(--tinta-55);">Aún no hay logros configurados.</p>';
  }).catch((error) => {
    resumen.textContent = `No se pudieron cargar los logros: ${error.message}`;
  });
})();
