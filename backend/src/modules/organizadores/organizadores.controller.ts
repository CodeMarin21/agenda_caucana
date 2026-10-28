import { Request, Response } from 'express';
import { MotivoEstado, MotivoReactivacion } from '@prisma/client';
import { OrganizadoresService } from './organizadores.service';

const service = new OrganizadoresService();

export const registroOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const resultado = await service.registrar(req.body);
    res.status(201).json({
      mensaje: 'Solicitud enviada. Un administrador verificará tu cuenta pronto.',
      usuario: {
        id: resultado.usuario.id,
        email: resultado.usuario.email,
        rol: resultado.usuario.rol,
      },
      organizador: {
        id: resultado.organizador.id,
        nombreEntidad: resultado.organizador.nombreEntidad,
        estado: resultado.organizador.estado,
      },
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al registrar';
    res.status(400).json({ error: mensaje });
  }
};

export const listarOrganizadores = async (_req: Request, res: Response): Promise<void> => {
  try {
    const organizadores = await service.listarTodos();
    res.json(organizadores);
  } catch {
    res.status(500).json({ error: 'Error al obtener organizadores' });
  }
};

export const listarPendientes = async (_req: Request, res: Response): Promise<void> => {
  try {
    const pendientes = await service.listarPendientes();
    res.json(pendientes);
  } catch {
    res.status(500).json({ error: 'Error al obtener pendientes' });
  }
};

export const verificarOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const organizador = await service.verificar(parseInt(req.params.id));
    res.json({ mensaje: 'Organizador verificado', organizador });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    res.status(404).json({ error: mensaje });
  }
};

export const suspenderOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const { motivo, detalle } = req.body as { motivo: MotivoEstado; detalle?: string };
    const organizador = await service.cambiarEstado(parseInt(req.params.id), motivo, detalle);
    res.json({ mensaje: 'Estado del organizador actualizado', organizador });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    res.status(404).json({ error: mensaje });
  }
};

export const vetarOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const { motivo, detalle } = req.body as { motivo: MotivoEstado; detalle?: string };
    const vetadoPorId = req.usuarioId!;
    const organizador = await service.vetar(id, motivo, detalle, vetadoPorId);
    res.json({
      mensaje: 'Organizador vetado. No podrá volver a registrarse con el mismo email o documento.',
      organizador,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al vetar';
    res.status(400).json({ error: mensaje });
  }
};

export const reactivarOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    const {
      motivo,
      detalle,
      notificar = true,
    } = req.body as { motivo: MotivoReactivacion; detalle?: string; notificar?: boolean };
    const organizador = await service.reactivar(
      id,
      motivo,
      detalle,
      req.usuarioId!,
      notificar
    );
    res.json({ mensaje: 'Organizador reactivado', organizador });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error al reactivar';
    res.status(400).json({ error: mensaje });
  }
};

export const obtenerPerfilOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = req.usuarioId!;
    const perfil = await service.obtenerPerfil(usuarioId);
    res.json(perfil);
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    const status = mensaje === 'Organizador no encontrado' ? 404 : 400;
    res.status(status).json({ error: mensaje });
  }
};

export const actualizarPerfilOrganizador = async (req: Request, res: Response): Promise<void> => {
  try {
    const usuarioId = req.usuarioId!;
    const actualizado = await service.actualizarPerfil(usuarioId, req.body);
    res.json({
      mensaje: 'Perfil actualizado',
      organizador: actualizado,
    });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : 'Error';
    const status = mensaje === 'Organizador no encontrado' ? 404 : 400;
    res.status(status).json({ error: mensaje });
  }
};