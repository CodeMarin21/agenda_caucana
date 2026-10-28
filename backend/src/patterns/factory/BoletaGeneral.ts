import { IBoleta } from './CreadorBoleta';

export class BoletaGeneral implements IBoleta {
  tipo = 'GENERAL';
  descripcion = 'Acceso general al evento';

  constructor(public precio: number) {}
}