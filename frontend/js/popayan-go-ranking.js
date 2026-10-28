/**
 * Popayán GO — Ranking (leaderboard público, sin auth requerida por el
 * endpoint, pero la página en sí vive dentro del área de jugador así que
 * igual aplicamos el guard para consistencia de navegación).
 */
(function () {
  if (typeof acProtegerPagina === 'function' && !acProtegerPagina('login.html')) return;

  const podio = document.querySelector('[data-podio]');
  const lista = document.querySelector('[data-lista-ranking]');
  const reinicioTexto = document.querySelector('[data-ranking-reinicio]');

  function avatarInicial(item) {
    return item.avatarUrl ? `<img src="${item.avatarUrl}" alt="${item.username}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : '🧭';
  }

  function pintarPodio(top3) {
    const orden = [top3[1], top3[0], top3[2]].filter(Boolean); // 2do, 1ro, 3ro (composición de podio)
    podio.innerHTML = orden.map((item) => {
      const puesto = item.posicion;
      const corona = puesto === 1 ? '👑 ' : '';
      return `
        <div class="go-podio__puesto go-podio__puesto--${puesto}">
          <div class="go-podio__avatar">${avatarInicial(item)}</div>
          <div class="go-podio__nombre">${corona}${item.username}</div>
          <div class="go-podio__label">Nv ${item.nivel}</div>
        </div>`;
    }).join('');
  }

  function pintarLista(resto) {
    lista.innerHTML = resto.map((item) => `
      <div class="go-fila-ranking">
        <span class="go-fila-ranking__puesto">${item.posicion}</span>
        <span class="go-fila-ranking__avatar">${avatarInicial(item)}</span>
        <span class="go-fila-ranking__nombre">${item.username} <span class="go-fila-ranking__nivel">· Nv ${item.nivel}</span></span>
        <span class="go-fila-ranking__puntos">${item.puntajeSemanal ?? item.puntajeTemporada} pts</span>
      </div>`).join('');
  }

  async function cargar(ciclo) {
    podio.innerHTML = '<p style="color:var(--tinta-40); font-size:0.85rem;">Cargando podio…</p>';
    lista.innerHTML = '';
    try {
      const data = await AC_API.leaderboard(ciclo);
      reinicioTexto.textContent = `Reinicia: ${data.reinicia}`;
      const top = data.top || [];
      pintarPodio(top.slice(0, 3));
      pintarLista(top.slice(3));
    } catch (error) {
      podio.innerHTML = `<p style="color:var(--color-rechazo); font-size:0.85rem;">No se pudo cargar el ranking: ${error.message}</p>`;
    }
  }

  document.querySelectorAll('[data-ranking-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-ranking-tab]').forEach((b) => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
      cargar(btn.dataset.rankingTab);
    });
  });

  cargar('semanal');
})();
