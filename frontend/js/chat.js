/**
 * Agenda Caucana — Chat IA flotante.
 * Disponible en todas las vistas públicas. Habla contra POST /api/chat.
 */
(function () {
  const boton = document.querySelector('[data-chat-boton]');
  const panel = document.querySelector('[data-chat-panel]');
  const cerrar = document.querySelector('[data-chat-cerrar]');
  const form = document.querySelector('[data-chat-form]');
  const input = document.querySelector('[data-chat-input]');
  const mensajes = document.querySelector('[data-chat-mensajes]');
  if (!boton || !panel || !form) return;

  function agregarMensaje(texto, quien) {
    const burbuja = document.createElement('div');
    burbuja.className = `chat-mensaje chat-mensaje--${quien}`;
    burbuja.textContent = texto;
    mensajes.appendChild(burbuja);
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  boton.addEventListener('click', () => panel.classList.toggle('abierto'));
  if (cerrar) cerrar.addEventListener('click', () => panel.classList.remove('abierto'));

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pregunta = input.value.trim();
    if (!pregunta) return;
    agregarMensaje(pregunta, 'usuario');
    input.value = '';

    try {
      const respuesta = await AC_API.preguntar(pregunta);
      // El nombre exacto del campo de respuesta puede variar según cómo lo
      // devuelva tu controlador de /api/chat — se prueban varios nombres
      // razonables y, si ninguno aparece, se muestra el JSON crudo en la
      // consola para poder ajustar esto rápido.
      const texto = respuesta.respuesta || respuesta.mensaje || respuesta.answer || respuesta.reply || respuesta.data;
      if (!texto) {
        console.warn('POST /api/chat respondió OK pero con un formato inesperado:', respuesta);
        agregarMensaje('La IA respondió, pero en un formato que el frontend todavía no reconoce (revisa la consola — F12 — para ver el JSON exacto y ajustamos el campo).', 'ia');
        return;
      }
      agregarMensaje(texto, 'ia');
    } catch (error) {
      // Antes esto se tragaba el error real. Ahora se muestra tal cual,
      // porque es la única forma de saber si es un 404 de ruta, un 500 del
      // backend, una CORS, o el Gemini API key sin configurar.
      console.error('Error en POST /api/chat:', error);
      agregarMensaje(`No pude obtener respuesta de la IA: ${error.message}. Revisa la consola (F12) y la terminal del backend para ver el detalle exacto.`, 'ia');
    }
  });
})();
