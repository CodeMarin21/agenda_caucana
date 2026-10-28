import { Request, Response } from 'express';
import { AiService } from './ai.service';
import { ChatRequestDTO } from './ai.dto';
import { normalizeIdioma } from './ai.types';

const aiService = new AiService();

// POST /api/chat
export async function chat(req: Request, res: Response): Promise<void> {
  try {
    const { pregunta, idioma, eventoId } = req.body as ChatRequestDTO;

    const result = await aiService.chat({
      pregunta: pregunta.trim(),
      idioma: idioma ?? normalizeIdioma(req.idioma),
      eventoId,
      ip: req.ip,
    });

    res.json(result);
  } catch (error) {
    console.error('[AI] Error en chat:', error);
    res.status(500).json({ error: 'Error al procesar tu consulta. Intenta de nuevo.' });
  }
}