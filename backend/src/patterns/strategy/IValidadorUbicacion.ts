export interface Coordenada {
  latitud: number;
  longitud: number;
}

export interface PuntoValidable {
  latitud: number | null;
  longitud: number | null;
  radioMetros: number;
}

export interface ResultadoValidacion {
  valido: boolean;
  distanciaMetros: number;
  razon?: string;
}

/**
 * Strategy — abstrae el algoritmo de validación de ubicación.
 *
 * Hoy: ValidadorRadioGPS (distancia Haversine <= radio del punto).
 * Futuro: se pueden añadir ValidadorPorBeacon, ValidadorPorQR,
 * ValidadorPorCodigoTemporal sin tocar GamificacionService.
 */
export interface IValidadorUbicacion {
  validar(origen: Coordenada, punto: PuntoValidable): ResultadoValidacion;
}