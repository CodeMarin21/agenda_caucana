import { Request, Response } from 'express';
import { AiService } from './ai.service';
import { ChatRequestDTO } from './ai.dto';
import { ChatResponse, normalizeIdioma } from './ai.types';

const aiService = new AiService();
const CHAT_REQUEST_BUDGET_MS = 2100;

function respuestaPorTiempo(idioma: ChatResponse['idioma']): ChatResponse {
  const mensajes = {
    es: 'La consulta está tardando más de lo esperado. Intenta de nuevo en un momento.',
    en: 'This is taking longer than expected. Please try again shortly.',
    fr: 'La réponse prend plus de temps que prévu. Veuillez réessayer dans un instant.',
  };
  return {
    respuesta: mensajes[idioma],
    fuente: 'fallback',
    idioma,
  };
}

// POST /api/chat
export async function chat(req: Request, res: Response): Promise<void> {
  let timeout: NodeJS.Timeout | undefined;
  try {
    const { pregunta, idioma, eventoId } = req.body as ChatRequestDTO;
    const idiomaRespuesta = idioma ?? normalizeIdioma(req.idioma);

    const result = await Promise.race([
      aiService.chat({
        pregunta: pregunta.trim(),
        idioma: idiomaRespuesta,
        eventoId,
        ip: req.ip,
      }),
      new Promise<ChatResponse>((resolve) => {
        timeout = setTimeout(
          () => resolve(respuestaPorTiempo(idiomaRespuesta)),
          CHAT_REQUEST_BUDGET_MS,
        );
      }),
    ]);

    res.json(result);
  } catch (error) {
    console.error('[AI] Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar tu consulta. Intenta de nuevo.' });
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}