import { IBoleta } from './CreadorBoleta';

export class BoletaPalco implements IBoleta {
  tipo = 'PALCO';
  descripcion = 'Acceso a palco con vista privilegiada';

  constructor(public precio: number) {}
}