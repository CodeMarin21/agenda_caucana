import { inferirEspecialidad } from '../modules/organizadores/especialidad.util';

describe('inferirEspecialidad', () => {
  it('preserves an explicitly assigned specialization', () => {
    expect(inferirEspecialidad('EVENTOS', { eventos: 0, negocios: 2 })).toBe('EVENTOS');
  });

  it('infers legacy accounts from their existing publications', () => {
    expect(inferirEspecialidad('POR_DEFINIR', { eventos: 0, negocios: 1 })).toBe('GASTRONOMIA');
    expect(inferirEspecialidad('POR_DEFINIR', { eventos: 1, negocios: 0 })).toBe('EVENTOS');
    expect(inferirEspecialidad('POR_DEFINIR', { eventos: 1, negocios: 1 })).toBe('EVENTOS');
    expect(inferirEspecialidad('POR_DEFINIR', { eventos: 0, negocios: 0 })).toBe('EVENTOS');
  });

  it('uses the legacy organization profile to recover its original module', () => {
    const noPublicaciones = { eventos: 0, negocios: 0 };
    expect(inferirEspecialidad('POR_DEFINIR', noPublicaciones, {
      nombreEntidad: 'Restaurante Doña Lupe',
    })).toBe('GASTRONOMIA');
    expect(inferirEspecialidad('POR_DEFINIR', noPublicaciones, {
      nombreEntidad: 'Tunel del tiempo',
      descripcion: 'Somos creadores de eventos de musica y deportes',
    })).toBe('EVENTOS');
  });
});
