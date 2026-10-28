import { BoletaGeneral } from './BoletaGeneral';
import { BoletaVIP }     from './BoletaVIP';
import { BoletaPalco }   from './BoletaPalco';

// Interfaz base que todas las boletas implementan
export interface IBoleta {
  tipo: string;
  precio: number;
  descripcion: string;
}

// Patrón Factory Method
// El cliente pide un tipo de boleta y la fábrica devuelve
// la instancia correcta sin que el cliente sepa cómo se construye
export class CreadorBoleta {
  static crear(tipo: 'GENERAL' | 'VIP' | 'PALCO', precio: number): IBoleta {
    switch (tipo) {
      case 'GENERAL': return new BoletaGeneral(precio);
      case 'VIP':     return new BoletaVIP(precio);
      case 'PALCO':   return new BoletaPalco(precio);
      default:        throw new Error(`Tipo de boleta desconocido: ${tipo}`);
    }
  }
}