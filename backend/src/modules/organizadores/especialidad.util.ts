export type EspecialidadEfectiva = 'EVENTOS' | 'GASTRONOMIA' | 'POR_DEFINIR';

type ContextoEspecialidad = {
  nombreEntidad?: string | null;
  descripcion?: string | null;
};

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
