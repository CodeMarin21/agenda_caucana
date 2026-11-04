/**
 * Agenda Caucana — Chat IA flotante.
 * Consulta información publicada mediante POST /api/chat.
 */
(function () {
  const boton = document.querySelector('[data-chat-boton]');
  const panel = document.querySelector('[data-chat-panel]');
  const cerrar = document.querySelector('[data-chat-cerrar]');
  const form = document.querySelector('[data-chat-form]');
  const input = document.querySelector('[data-chat-input]');
  const mensajes = document.querySelector('[data-chat-mensajes]');
  if (!boton || !panel || !form || !input || !mensajes) return;

  const submit = form.querySelector('button[type="submit"]');

  function enlazarUrl(destino) {
    const internoEvento = destino.match(/^\/eventos\/([a-z0-9-]+)$/i);
    if (internoEvento) return `evento.html?slug=${encodeURIComponent(internoEvento[1])}`;

    const internoNegocio = destino.match(/^\/negocios\/([a-z0-9-]+)$/i);
    if (internoNegocio) return `negocio.html?slug=${encodeURIComponent(internoNegocio[1])}`;

    if (/^(evento|negocio)\.html\?slug=[a-z0-9-]+$/i.test(destino)) return destino;

    try {
      const url = new URL(destino);
      return url.protocol === 'https:' ? url.href : null;
    } catch {
      return null;
    }
  }

  function agregarContenido(burbuja, texto) {
    const enlaceMarkdown = /\[([^\]]+)\]\(([^)]+)\)/g;
    let inicio = 0;
    let coincidencia;
    while ((coincidencia = enlaceMarkdown.exec(texto))) {
      burbuja.appendChild(document.createTextNode(texto.slice(inicio, coincidencia.index)));
      const href = enlazarUrl(coincidencia[2].trim());
      if (!href) {
        burbuja.appendChild(document.createTextNode(coincidencia[1]));
      } else {
        const enlace = document.createElement('a');
        enlace.href = href;
        enlace.textContent = coincidencia[1];
        if (/^https:\/\//i.test(href)) {
          enlace.target = '_blank';
          enlace.rel = 'noopener noreferrer';
        }
        burbuja.appendChild(enlace);
      }
      inicio = coincidencia.index + coincidencia[0].length;
    }
    burbuja.appendChild(document.createTextNode(texto.slice(inicio)));
  }

  function agregarMensaje(texto, quien) {
    const burbuja = document.createElement('div');
    burbuja.className = `chat-mensaje chat-mensaje--${quien}`;
    if (quien === 'ia') {
      agregarContenido(burbuja, texto);
      burbuja.setAttribute('role', 'status');
    } else {
      burbuja.textContent = texto;
    }
    mensajes.appendChild(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
    return burbuja;
  }

  boton.addEventListener('click', () => panel.classList.toggle('abierto'));
  if (cerrar) cerrar.addEventListener('click', () => panel.classList.remove('abierto'));

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pregunta = input.value.trim();
    if (!pregunta || submit?.disabled) return;
    agregarMensaje(pregunta, 'usuario');
    input.value = '';
    if (submit) submit.disabled = true;
    input.disabled = true;
    const cargando = agregarMensaje('Buscando en eventos y negocios publicados…', 'ia');

    try {
      const respuesta = await AC_API.preguntar(pregunta);
      const texto = respuesta?.respuesta;
      if (typeof texto !== 'string' || !texto.trim()) {
        throw new Error('El asistente devolvió una respuesta vacía.');
      }
      cargando.remove();
      agregarMensaje(texto, 'ia');
    } catch (error) {
      cargando.remove();
      agregarMensaje('No pude consultar la agenda en este momento. Intenta de nuevo en unos segundos.', 'ia');
      console.error('Error en POST /api/chat:', error);
    } finally {
      if (submit) submit.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });
})();
