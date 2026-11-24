export type EspecialidadEfectiva = 'EVENTOS' | 'GASTRONOMIA' | 'POR_DEFINIR';

type ContextoEspecialidad = {
  nombreEntidad?: string | null;
  descripcion?: string | null;
};

type OrganizadorConPublicaciones = ContextoEspecialidad & {
  especialidad: string;
  _count: { eventos: number };
  negocio?: unknown;
};

export function contarPublicacionesOrganizador(
  organizador: Pick<OrganizadorConPublicaciones, '_count' | 'negocio'>,
) {
  return {
    eventos: organizador._count.eventos,
    negocios: organizador.negocio ? 1 : 0,
  };
}

export function inferirEspecialidadOrganizador(
  organizador: OrganizadorConPublicaciones,
): EspecialidadEfectiva {
  return inferirEspecialidad(
    organizador.especialidad,
    contarPublicacionesOrganizador(organizador),
    organizador,
  );
}

export function inferirEspecialidad(
  especialidad: string,
  publicaciones: { eventos: number; negocios: number },
  contexto: ContextoEspecialidad = {},
): EspecialidadEfectiva {
  if (especialidad === 'EVENTOS' || especialidad === 'GASTRONOMIA') return especialidad;
  if (especialidad !== 'POR_DEFINIR') return 'POR_DEFINIR';
  if (publicaciones.negocios > 0 && publicaciones.eventos === 0) return 'GASTRONOMIA';
  if (publicaciones.eventos > 0 && publicaciones.negocios === 0) return 'EVENTOS';

  const texto = `${contexto.nombreEntidad ?? ''} ${contexto.descripcion ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();
  const indicaGastronomia = /(restaurante|cafeteria|gastronomia|comida|cocina|plato|alimento|bebida|cholado|sabores)/.test(texto);
  const indicaEventos = /(evento|festival|concierto|musica|deporte|cultura|agenda)/.test(texto);

  if (indicaGastronomia && !indicaEventos) return 'GASTRONOMIA';
  return 'EVENTOS';
}
