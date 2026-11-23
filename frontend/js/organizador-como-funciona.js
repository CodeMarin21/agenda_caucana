(function () {
  const tablist = document.querySelector('[data-recorrido] [role="tablist"]');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[data-paso-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-paso-panel]'));
  const progress = document.querySelector('[data-paso-progreso]');
  if (tabs.length === 0 || tabs.length !== panels.length) return;

  function activarPaso(indice, enfocar = false) {
    const paso = Math.max(0, Math.min(indice, tabs.length - 1));
    tabs.forEach((tab, i) => {
      const activo = i === paso;
      tab.setAttribute('aria-selected', String(activo));
      tab.tabIndex = activo ? 0 : -1;
      panels[i].hidden = !activo;
    });
    if (progress) progress.style.width = `${((paso + 1) / tabs.length) * 100}%`;
    if (enfocar) tabs[paso].focus();
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-paso-tab]');
    if (!tab) return;
    activarPaso(Number(tab.dataset.pasoTab));
  });

  tablist.addEventListener('keydown', (event) => {
    const actual = tabs.indexOf(document.activeElement);
    if (actual < 0) return;
    let siguiente;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') siguiente = (actual + 1) % tabs.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') siguiente = (actual - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') siguiente = 0;
    else if (event.key === 'End') siguiente = tabs.length - 1;
    else return;
    event.preventDefault();
    activarPaso(siguiente, true);
  });

  document.querySelector('[data-recorrido]').addEventListener('click', (event) => {
    const boton = event.target.closest('[data-paso-siguiente], [data-paso-anterior]');
    if (!boton) return;
    const actual = tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true');
    activarPaso(actual + (boton.hasAttribute('data-paso-siguiente') ? 1 : -1), true);
  });

  activarPaso(0);
})();
