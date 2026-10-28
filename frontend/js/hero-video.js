/**
 * Agenda Caucana — Hero en loop.
 *
 * v3: el archivo de video en sí (assets/hero/hero-popayan-loop.mp4) ya es
 * un "boomerang" — el clip original seguido de sí mismo invertido cuadro a
 * cuadro (generado con ffmpeg) — así que el final del archivo YA es
 * idéntico al principio. Eso permite usar el `loop` nativo del navegador
 * sin ningún corte visible: no hay reinicio perceptible ni scrubbing por
 * JS (esa fue la v2, y fallaba: retroceder un H.264 cuadro a cuadro con
 * requestAnimationFrame es lento y se veía congelado). Lo único que hace
 * este script es reproducir con loop nativo y pausar/reanudar con
 * IntersectionObserver cuando el hero entra o sale de la pantalla, para no
 * gastar batería/CPU mientras el usuario ve el resto del sitio.
 */
(function () {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;

  const prefiereMenosMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esMovilAngosto = window.matchMedia('(max-width: 640px)').matches;

  if (prefiereMenosMovimiento || esMovilAngosto) {
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
