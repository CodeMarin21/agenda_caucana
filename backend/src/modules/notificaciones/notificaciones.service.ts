import { IObserver, EventoAprobadoData } from '../../patterns/observer/IObserver';
import { prisma } from '../../config/database';
import { enviarCorreo } from './email.service';

// Observador concreto: notifica por correo a suscriptores de la categoría
export class NotificacionSuscriptoresObserver implements IObserver {
  async notificar(data: EventoAprobadoData): Promise<void> {
    try {
      const suscripciones = await prisma.suscripcion.findMany({
        where: {
          categoriaId: data.categoriaId,
          activa: true,
        },
      });

      for (const s of suscripciones) {
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Nuevo evento en Agenda Caucana</h2>
            <h3 style="color: #555;">${data.titulo}</h3>
            <p><strong>Categoría:</strong> ${data.categoriaNombre}</p>
            <p><strong>Lugar:</strong> ${data.lugarNombre}</p>
            <p><strong>Fecha:</strong> ${new Date(data.fechaInicio).toLocaleDateString('es-CO')}</p>
            <a href="${process.env.FRONTEND_URL}" 
               style="background:#333;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">
              Ver todos los eventos
            </a>
          </div>
        `;
        await enviarCorreo(s.email, `Nuevo evento: ${data.titulo}`, html);
      }
    } catch (error) {
      // No romper el flujo si falla el correo
      console.error('Error enviando notificaciones:', error);
    }
  }
}