/**
 * Reproduce el hero en bucle y pausa el video solo mientras está fuera de
 * pantalla. Respeta la preferencia del usuario de reducir movimiento.
 */
(function () {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;

  const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefiereMenosMovimiento) {
    video.remove();
    return;
  }

  video.loop = true;
  video.play().catch(() => {
    // Autoplay bloqueado por el navegador — se queda mostrando el poster.
  });

  if ('IntersectionObserver' in window) {
    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            video.play().catch(() => {});
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.1 }
    );
    observador.observe(video.closest('.hero'));
  }
})();
