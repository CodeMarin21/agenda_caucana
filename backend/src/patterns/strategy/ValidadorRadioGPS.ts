import {
  IValidadorUbicacion,
  Coordenada,
  PuntoValidable,
  ResultadoValidacion,
} from './IValidadorUbicacion';

/**
 * Valida que el usuario esté dentro del radio permitido del punto.
 * Fórmula de Haversine (distancia entre dos puntos sobre una esfera).
 *
 * Precisión: ±0.5% a escala urbana, más que suficiente para check-in.
 * Si el punto no tiene coordenadas (lat/lng null), se rechaza.
 */
export class ValidadorRadioGPS implements IValidadorUbicacion {
  validar(origen: Coordenada, punto: PuntoValidable): ResultadoValidacion {
    if (punto.latitud === null || punto.longitud === null) {
      return {
        valido: false,
        distanciaMetros: -1,
        razon: 'El punto de interés no tiene coordenadas registradas',
      };
    }

    const distancia = this.haversine(
      origen.latitud,
      origen.longitud,
      punto.latitud,
      punto.longitud
    );

    if (distancia <= punto.radioMetros) {
      return { valido: true, distanciaMetros: distancia };
    }

    return {
      valido: false,
      distanciaMetros: distancia,
      razon: `Estás a ${Math.round(distancia)}m del punto. Debes estar a menos de ${punto.radioMetros}m.`,
    };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000;
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(lat2 - lat1);
    const dLon = rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }
}