import { MotivoEstado } from '@prisma/client';

export const MOTIVOS_RECHAZO: Partial<Record<MotivoEstado, string>> = {
  INFORMACION_INCOMPLETA: 'La información proporcionada está incompleta o es insuficiente para verificar tu identidad.',
  DOCUMENTO_NO_VERIFICABLE: 'No pudimos verificar tu documento de identidad. Verifica el número e inténtalo de nuevo.',
  ENTIDAD_DUPLICADA: 'Ya existe un organizador registrado con un nombre de entidad similar al tuyo.',
  CONTACTO_DUPLICADO: 'El email o teléfono ya están asociados a otra cuenta de organizador.',
  DATOS_SOSPECHOSOS: 'Detectamos inconsistencias en los datos suministrados.',
  TYC_INCUMPLIDOS: 'Incumples los términos y condiciones de la plataforma.',
  OTRO: 'Razón específica indicada por el administrador.',
};

export const MOTIVOS_SUSPENSION: Partial<Record<MotivoEstado, string>> = {
  EVENTO_FALSO: 'Se detectó un evento con información falsa o engañosa.',
  CONTENIDO_INAPROPIADO: 'Publicaste contenido que viola nuestras políticas.',
  QUEJAS_USUARIOS: 'Recibimos múltiples quejas de usuarios sobre tus eventos.',
  INACTIVIDAD: 'Tu cuenta lleva más de 90 días sin publicar. Puedes solicitar la reactivación contactando al admin.',
  SOLICITUD_ORGANIZADOR: 'Tu cuenta fue suspendida por solicitud propia.',
  TYC_INCUMPLIDOS: 'Incumpliste los términos y condiciones de la plataforma.',
  OTRO: 'Razón específica indicada por el administrador.',
};

export const MOTIVOS_VETO: Partial<Record<MotivoEstado, string>> = {
  SUPLANTACION: 'Se comprobó suplantación de identidad.',
  FRAUDE: 'Se comprobó actividad fraudulenta.',
  MULTIPLES_SUSPENSIONES: 'Acumulación de suspensiones previas.',
  ACTIVIDAD_ILEGAL: 'Se detectó actividad ilegal.',
  DOCUMENTO_FALSIFICADO: 'El documento de identidad proporcionado es falso.',
  TYC_INCUMPLIDOS: 'Incumpliste los términos y condiciones de la plataforma.',
  OTRO: 'Razón específica indicada por el administrador.',
};

export const todosLosMotivos = Object.values(MotivoEstado);

export const MOTIVOS_REACTIVACION = {
  ERROR_ADMINISTRATIVO: 'El veto anterior fue un error administrativo.',
  APELACION_ACEPTADA: 'El organizador apeló y aportó pruebas suficientes.',
  SANCION_CUMPLIDA: 'La sanción temporal se cumplió.',
  CONDICIONES_CAMBIADAS: 'Cambiaron las condiciones del caso.',
  ORDEN_LEGAL: 'Por orden legal o requerimiento de autoridad.',
  OTRO: 'Otro (especificar en nota).',
} as const;
